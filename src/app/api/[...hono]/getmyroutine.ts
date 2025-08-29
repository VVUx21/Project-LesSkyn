import { Hono } from 'hono';
import { getCachedProducts } from '@/lib/server/products.actions';
import generateSkincareRoutine, { generateSkincareRoutineStream } from '@/lib/server/gemini.action';
import { saveRoutineToDatabase,validateRequest } from '@/lib/utils';
import { client as redis } from "@/lib/server/redis";
import { GenerateRoutineRequest } from "@/lib/types";

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

getMyRoutine.post('/getmyroutine', async (c) => {
  const startTime = Date.now();
  const url = new URL(c.req.url);
  const streaming = url.searchParams.get('stream') === 'true';

  try {
    let body: GenerateRoutineRequest;
    try {
      body = await c.req.json();
    } catch {
      return c.json({
        success: false,
        error: 'Invalid JSON in request body',
        processingTime: Date.now() - startTime
      }, 400);
    }

    const validation = validateRequest(body);
    if (!validation.isValid) {
      return c.json({
        success: false,
        error: 'Validation failed',
        details: validation.errors,
        processingTime: Date.now() - startTime
      }, 400);
    }

    const {
      skinType,
      skinConcern,
      commitmentLevel,
      preferredProducts,
      limit = 200,
    } = body;

    console.log('🔄 Fetching products...');
    const allProducts = await getCachedProducts(limit);
    if (allProducts.length === 0) {
      return c.json({
        success: false,
        error: 'No products available for routine generation',
        processingTime: Date.now() - startTime
      }, 404);
    }

    const cacheKey = cacheKeyFor(skinType, skinConcern);
    const cachedRaw = await redis.get(cacheKey);
    const cachedRoutine = normalizeCached<any>(cachedRaw);

    if (streaming) {
      if (cachedRoutine) {
        console.log("⚡ Cache hit (SSE):", cacheKey);
        const stream = new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'metadata',
              data: {
                totalProducts: allProducts.length,
                analyzedProducts: allProducts.length,
                startTime: Date.now(),
                source: 'cache',
              }
            })}\n\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'complete',
              data: cachedRoutine
            })}\n\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'metadata',
              data: { processingTime: Date.now() - startTime, completed: true }
            })}\n\n`));
            controller.close();
          }
        });

        c.header('Content-Type', 'text/event-stream');
        c.header('Cache-Control', 'no-cache');
        c.header('Connection', 'keep-alive');
        c.header('Access-Control-Allow-Origin', '*');
        return c.body(stream);
      }

      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const abortSignal = c.req.raw.signal;
          let completeRoutineData: any = null;

          const onAbort = () => {
            try { controller.close(); } catch {}
            console.warn('🚪 Client disconnected (aborted SSE).');
          };
          abortSignal.addEventListener("abort", onAbort);

          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'metadata',
              data: {
                totalProducts: allProducts.length,
                analyzedProducts: allProducts.length,
                startTime: Date.now(),
                source: 'generation',
              }
            })}\n\n`));

            const routineStream = generateSkincareRoutineStream(
              allProducts,
              skinType,
              skinConcern,
              commitmentLevel,
              preferredProducts
            );

            for await (const chunk of routineStream) {
              let payload: any;
              try {
                payload = JSON.parse(chunk);
              } catch {
                const errMsg = { type: 'error', error: 'Malformed stream chunk' };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(errMsg)}\n\n`));
                break;
              }

              if (payload.type === 'complete') {
                completeRoutineData = payload.data;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
                try {
                  await saveRoutineToDatabase(skinType, skinConcern, commitmentLevel, JSON.stringify(completeRoutineData));
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'database_saved', message: 'Routine successfully saved to database' })}\n\n`));
                } catch (dbError) {
                  console.error('❌ Database save error:', dbError);
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'database_error', error: 'Failed to save routine to database' })}\n\n`));
                }
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'metadata',
                  data: { processingTime: Date.now() - startTime, completed: true }
                })}\n\n`));
                break;
              }

              if (payload.type === 'error') {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: payload.error || 'Stream error' })}\n\n`));
                break;
              }
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
              break;
            }
          } catch (error: any) {
            console.error('❌ STREAMING ERROR:', error);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: error.message || 'Stream processing failed' })}\n\n`));
          } finally {
            console.log('🔚 STREAMING ENDED');
            abortSignal.removeEventListener("abort", onAbort);
            try { controller.close(); } catch {}
          }
        }
      });
      c.header('Content-Type', 'text/event-stream');
      c.header('Cache-Control', 'no-cache');
      c.header('Connection', 'keep-alive');
      c.header('Access-Control-Allow-Origin', '*');
      return c.body(stream);
    }

    // ===== NON-STREAMING PATH =====
    if (cachedRoutine) {
      console.log("⚡ Cache hit (JSON):", cacheKey);
      const processingTime = Date.now() - startTime;
      c.header('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
      return c.json({
        success: true,
        data: cachedRoutine,
        databaseSaved: false,
        metadata: {
          totalProducts: allProducts.length,
          analyzedProducts: allProducts.length,
          processingTime,
          source: 'cache',
        }
      }, 200);
    }

    console.log('🤖 Generating skincare routine (non-streaming)...');
    const routine = await generateSkincareRoutine(allProducts, skinType, skinConcern, commitmentLevel, preferredProducts);

    if (!routine) {
      return c.json({
        success: false,
        error: 'Failed to generate routine',
        processingTime: Date.now() - startTime
      }, 500);
    }

    let savedDocument = null;
    try {
      savedDocument = await saveRoutineToDatabase(skinType, skinConcern, 'standard', JSON.stringify(routine));
      await redis.set(cacheKey, JSON.stringify(routine), "EX", 3600);
    } catch (dbError) {
      console.error('❌ Database save error:', dbError);
    }

    const processingTime = Date.now() - startTime;
    console.log(`✅ Routine generated successfully in ${processingTime}ms`);

    c.header('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return c.json({
      success: true,
      data: routine,
      databaseSaved: savedDocument !== null,
      documentId: savedDocument?.$id,
      metadata: {
        totalProducts: allProducts.length,
        analyzedProducts: allProducts.length,
        processingTime,
        source: 'generation',
      }
    }, 200);
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error('❌ Error in generate-routine API:', error);
    return c.json({
      success: false,
      error: error.message || 'Internal server error',
      processingTime
    }, 500);
  }
});

export default getMyRoutine;