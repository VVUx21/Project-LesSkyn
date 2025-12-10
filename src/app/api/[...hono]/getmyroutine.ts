import { Hono } from 'hono';
import { getCachedProducts } from '@/lib/server/products.actions';
import { generateSkincareRoutineStream } from '@/lib/server/openai.action';
import { saveRoutineToDatabase, validateRequest } from '@/lib/utils';
import { client as redis } from "@/lib/server/redis";
import { realtime, createStreamSession, updateStreamSession } from "@/lib/server/upstash";
import { GenerateRoutineRequest } from "@/lib/types";
import { rateLimiter } from './ratelimiter';

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

const routineratelimit = rateLimiter({
  windowInSeconds: 300,
  maxRequests: 5
});

// ===== REALTIME STREAMING ENDPOINT =====
// Uses Upstash Redis channels for real-time updates (like the workflow pattern)
getMyRoutine.post('/getmyroutine/realtime', routineratelimit, async (c) => {
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

// Endpoint to poll for channel messages (for clients that can't use SSE)
getMyRoutine.get('/getmyroutine/channel/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId');
  
  if (!sessionId) {
    return c.json({ success: false, error: 'sessionId is required' }, 400);
  }

  try {
    const channel = realtime.channel(sessionId);
    const messages = await channel.getMessages(50);
    
    return c.json({ 
      success: true, 
      messages: messages.reverse() // Return in chronological order
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

export default getMyRoutine;