import { Hono } from 'hono';
import { getCachedProducts } from '@/lib/server/products.actions';
import { generateSkincareRoutineStream } from '@/lib/server/gemini.action';
import { saveRoutineToDatabase, validateRequest } from '@/lib/utils';
import { client as redis } from "@/lib/server/redis";
import { realtime, createStreamSession, updateStreamSession } from "@/lib/server/upstash";
import { GenerateRoutineRequest } from "@/lib/types";
import { rateLimiter } from './ratelimiter';
import { requireAuth } from './auth';

const getMyRoutine = new Hono();

const normalizeCached = <T>(val: any): T | null => {
  if (val == null) return null;
  if (typeof val === 'string') {
    try { return JSON.parse(val) as T; } catch { return null; }
  }
  return val as T;
};

const cacheKeyFor = (skinType: string, skinConcern: string) =>
  `routine:${skinType.trim()}:${skinConcern.trim()}`;

const routineGenerateRateLimit = rateLimiter({
  windowInSeconds: 300,
  maxRequests: 5,
  keyPrefix: 'rate-limit:routine-generate',
  getIdentifier: (c) => {
    const auth = c.get('auth') as { userId?: string } | undefined;
    return auth?.userId || '';
  }
});

const routineReadRateLimit = rateLimiter({
  windowInSeconds: 60,
  maxRequests: 120,
  keyPrefix: 'rate-limit:routine-stream',
  getIdentifier: (c) => {
    const auth = c.get('auth') as { userId?: string } | undefined;
    return auth?.userId || '';
  }
});

// ===== REALTIME STREAMING ENDPOINT =====
// Uses Upstash Redis channels for real-time updates (like the workflow pattern)
getMyRoutine.post('/getmyroutine/realtime', requireAuth, routineGenerateRateLimit, async (c) => {
  const startTime = Date.now();

  try {
    let body: GenerateRoutineRequest & { sessionId: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ success: false, error: 'Invalid JSON' }, 400);
    }

    const { sessionId, skinType, skinConcern, commitmentLevel, preferredProducts, limit = 200 } = body;

    if (!sessionId) {
      return c.json({ success: false, error: 'sessionId is required for realtime streaming' }, 400);
    }

    const validation = validateRequest(body);
    if (!validation.isValid) {
      return c.json({ success: false, error: 'Validation failed', details: validation.errors }, 400);
    }

    // Create the realtime channel for this session
    const channel = realtime.channel(sessionId);

    // Clear any previous messages
    await channel.clear();

    // Create stream session metadata
    await createStreamSession(sessionId, {
      skinType,
      skinConcern,
      commitmentLevel,
      preferredProducts,
      startTime
    });

    // Emit initial status
    await channel.emit('ai.status', { 
      type: 'started', 
      message: 'Fetching products...',
      timestamp: Date.now()
    });

    // Fetch products
    const allProducts = await getCachedProducts(limit);
    if (allProducts.length === 0) {
      await channel.emit('ai.error', { error: 'No products available' });
      return c.json({ success: false, error: 'No products available' }, 404);
    }

    await channel.emit('ai.status', { 
      type: 'products_loaded', 
      message: `Loaded ${allProducts.length} products`,
      totalProducts: allProducts.length 
    });

    // Check cache first
    const cacheKey = cacheKeyFor(skinType, skinConcern);
    const cachedRaw = await redis.get(cacheKey);
    const cachedRoutine = normalizeCached<any>(cachedRaw);

    if (cachedRoutine) {
      await channel.emit('ai.status', { type: 'cache_hit', message: 'Found cached routine' });
      await channel.emit('ai.complete', { 
        routine: cachedRoutine, 
        cached: true,
        processingTime: Date.now() - startTime 
      });
      await updateStreamSession(sessionId, { status: 'completed', cached: true });
      return c.json({ success: true, sessionId, cached: true });
    }

    // Start AI generation
    await channel.emit('ai.status', { 
      type: 'generating', 
      message: 'AI is analyzing products and creating your routine...' 
    });

    // Run the AI generation and emit chunks to channel
    const routineStream = generateSkincareRoutineStream(
      allProducts,
      skinType,
      skinConcern,
      commitmentLevel,
      preferredProducts
    );

    let completeRoutineData: any = null;

    for await (const chunk of routineStream) {
      let payload: any;
      try {
        payload = JSON.parse(chunk);
      } catch {
        await channel.emit('ai.error', { error: 'Malformed stream chunk' });
        break;
      }

      if (payload.type === 'progress') {
        await channel.emit('ai.chunk', { 
          type: 'progress',
          chunksReceived: payload.data.chunksReceived,
          bufferSize: payload.data.bufferSize
        });
      } else if (payload.type === 'complete') {
        completeRoutineData = payload.data;
        
        // Emit the complete routine
        await channel.emit('ai.complete', { 
          routine: completeRoutineData,
          cached: false,
          processingTime: Date.now() - startTime
        });

        // Save to database
        try {
          await saveRoutineToDatabase(skinType, skinConcern, commitmentLevel, JSON.stringify(completeRoutineData));
          await redis.set(cacheKey, JSON.stringify(completeRoutineData), "EX", 3600);
          await channel.emit('ai.status', { type: 'saved', message: 'Routine saved successfully' });
        } catch (dbError) {
          console.error('❌ Database save error:', dbError);
          await channel.emit('ai.warning', { message: 'Failed to save routine to database' });
        }

        await updateStreamSession(sessionId, { status: 'completed', cached: false });
        break;
      } else if (payload.type === 'error') {
        await channel.emit('ai.error', { error: payload.error });
        await updateStreamSession(sessionId, { status: 'error', error: payload.error });
        break;
      }
    }

    return c.json({ 
      success: true, 
      sessionId,
      message: 'Generation started. Listen to channel for updates.'
    });

  } catch (error: any) {
    console.error('❌ Realtime generation error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ===== SSE STREAMING ENDPOINT =====
// Server-Sent Events endpoint for real-time updates (replaces polling)
getMyRoutine.get('/getmyroutine/stream/:sessionId', requireAuth, routineReadRateLimit, async (c) => {
  const sessionId = c.req.param('sessionId');
  
  if (!sessionId) {
    return c.json({ success: false, error: 'sessionId is required' }, 400);
  }

  try {
    // Set SSE headers
    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');
    c.header('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Create a stream that pushes Redis channel events to the client
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const channel = realtime.channel(sessionId);
        let isClosed = false;
        // Cursor here is the next list index to read from.
        // We support resumability via SSE Last-Event-ID (auto-reconnect) and `?cursor=` (full refresh).
        let cursor = 0;
        
        // Helper to safely close the stream
        const safeClose = () => {
          if (!isClosed) {
            isClosed = true;
            clearInterval(pollInterval);
            clearTimeout(timeoutHandle);
            try {
              controller.close();
            } catch (error) {
              console.error('Error closing controller:', error);
            }
          }
        };
        
        // Send initial connection message
        const cursorParam = c.req.query('cursor');
        const lastEventIdHeader = c.req.raw.headers.get('last-event-id');

        const parsedCursorParam = cursorParam ? Number.parseInt(cursorParam, 10) : NaN;
        const parsedLastEventId = lastEventIdHeader ? Number.parseInt(lastEventIdHeader, 10) : NaN;

        if (Number.isFinite(parsedLastEventId) && parsedLastEventId >= 0) {
          cursor = parsedLastEventId + 1;
        } else if (Number.isFinite(parsedCursorParam) && parsedCursorParam >= 0) {
          cursor = parsedCursorParam;
        } else {
          cursor = 0;
        }

        // Send initial connection message.
        // Note: `id:` is what lets browsers resume automatically on transient disconnects.
        const initialMsg = `id: ${Math.max(-1, cursor - 1)}\nevent: connected\ndata: ${JSON.stringify({ sessionId, cursor, timestamp: Date.now() })}\n\n`;
        controller.enqueue(encoder.encode(initialMsg));

        // Poll Redis channel for messages (Upstash doesn't support true pub/sub subscriptions)
        const pollInterval = setInterval(async () => {
          if (isClosed) return;
          
          try {
            const batch = await channel.readBatch(cursor, 50);
            const messages = batch.messages;
            const nextCursor = batch.nextCursor;

            // Send each new message as an SSE event (already chronological)
            for (let i = 0; i < messages.length; i++) {
              if (isClosed) return;

              const msg = messages[i];
              const eventId = cursor + i;
              
              const eventData = `id: ${eventId}\nevent: ${msg.event}\ndata: ${JSON.stringify(msg.data)}\n\n`;
              controller.enqueue(encoder.encode(eventData));
              
              // Close stream on completion or error
              if (msg.event === 'ai.complete' || msg.event === 'ai.error') {
                safeClose();
                return;
              }
            }

            // Advance cursor only after sending.
            cursor = nextCursor;
          } catch (error) {
            console.error('SSE polling error:', error);
          }
        }, 1000); // Poll every 1 second (still better than client polling)

        // Cleanup on client disconnect
        const abortHandler = () => {
          safeClose();
        };
        
        c.req.raw.signal.addEventListener('abort', abortHandler);
        
        // Timeout after 3 minutes
        const timeoutHandle = setTimeout(() => {
          if (!isClosed) {
            const timeoutMsg = `event: timeout\ndata: ${JSON.stringify({ message: 'Connection timed out' })}\n\n`;
            controller.enqueue(encoder.encode(timeoutMsg));
            safeClose();
          }
        }, 180000);
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      }
    });

  } catch (error: any) {
    console.error('❌ SSE streaming error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Endpoint to poll for channel messages (fallback for clients that can't use SSE)
getMyRoutine.get('/getmyroutine/channel/:sessionId', requireAuth, routineReadRateLimit, async (c) => {
  const sessionId = c.req.param('sessionId');
  
  if (!sessionId) {
    return c.json({ success: false, error: 'sessionId is required' }, 400);
  }

  try {
    const channel = realtime.channel(sessionId);
    const cursorParam = c.req.query('cursor');
    const cursor = cursorParam ? Number.parseInt(cursorParam, 10) : 0;
    const { messages, nextCursor } = await channel.readBatch(Number.isFinite(cursor) ? cursor : 0, 50);
    
    return c.json({ 
      success: true, 
      messages,
      nextCursor
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

export default getMyRoutine;