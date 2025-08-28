'use server';
import { NextRequest, NextResponse } from 'next/server';
import generateSkincareRoutine, { generateSkincareRoutineStream } from '@/lib/server/gemini.action';
import { GenerateRoutineRequest } from "../../../lib/types";
import { saveRoutineToDatabase, validateRequest } from '@/lib/utils';
import { getCachedProducts } from '@/lib/server/products.actions';
import { client as redis } from "@/lib/server/redis"; // Works with Upstash REST or ioredis

const cacheKeyFor = (skinType: string, skinConcern: string) =>
  `routine:${skinType.trim()}:${skinConcern.trim()}`;

// parse cached value regardless of driver (Upstash REST returns objects; ioredis returns strings)
function normalizeCached<T>(val: any): T | null {
  if (val == null) return null;
  if (typeof val === 'string') {
    try { return JSON.parse(val) as T; } catch { return null; }
  }
  // Upstash REST returns deserialized object directly
  return val as T;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const url = new URL(request.url);
  const streaming = url.searchParams.get('stream') === 'true';

  try {
    // ---- Parse & validate body ----
    let body: GenerateRoutineRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body', processingTime: Date.now() - startTime },
        { status: 400 }
      );
    }

    const validation = validateRequest(body);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.errors, processingTime: Date.now() - startTime },
        { status: 400 }
      );
    }

    const {
      skinType,
      skinConcern,
      commitmentLevel,
      preferredProducts,
      limit = 200,
    } = body;

    // ---- Fetch products (for your downstream logic & metadata) ----
    console.log('🔄 Fetching products...');
    const allProducts = await getCachedProducts(limit);
    if (allProducts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No products available for routine generation', processingTime: Date.now() - startTime },
        { status: 404 }
      );
    }

    // ---- Cache check ----
    const cacheKey = cacheKeyFor(skinType, skinConcern);
    const cachedRaw = await redis.get(cacheKey);
    const cachedRoutine = normalizeCached<any>(cachedRaw);

    // ===== STREAMING (SSE) PATH =====
    if (streaming) {
      console.log('🌊 Starting streaming routine generation...');

      // If cached → stream complete payload immediately and end
      if (cachedRoutine) {
        console.log("⚡ Cache hit (SSE):", cacheKey);

        const stream = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder();

            // initial metadata
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'metadata',
              data: {
                totalProducts: allProducts.length,
                analyzedProducts: allProducts.length,
                startTime: Date.now(),
                source: 'cache',
              }
            })}\n\n`));

            // complete payload from cache
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'complete',
              data: cachedRoutine
            })}\n\n`));

            // final metadata
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'metadata',
              data: { processingTime: Date.now() - startTime, completed: true }
            })}\n\n`));

            controller.close();
          }
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        });
      }

      // No cache → generate & stream
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const abortSignal = request.signal;
          let completeRoutineData: any = null;

          const onAbort = () => {
            try { controller.close(); } catch {}
            console.warn('🚪 Client disconnected (aborted SSE).');
          };
          abortSignal.addEventListener("abort", onAbort);

          try {
            // initial metadata
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'metadata',
              data: {
                totalProducts: allProducts.length,
                analyzedProducts: allProducts.length,
                startTime: Date.now(),
                source: 'generation',
              }
            })}\n\n`));

            // run the generator (now emits a single {type:'complete'} or {type:'error'})
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

                // emit complete
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

                // DB save (best effort)
                try {
                  await saveRoutineToDatabase(
                    skinType,
                    skinConcern,
                    commitmentLevel,
                    JSON.stringify(completeRoutineData)
                  );
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'database_saved', message: 'Routine successfully saved to database' })}\n\n`));
                } catch (dbError) {
                  console.error('❌ Database save error:', dbError);
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'database_error', error: 'Failed to save routine to database' })}\n\n`));
                }

                // final metadata
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

              // unexpected type → forward and stop
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

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // ===== NON-STREAMING PATH =====
    if (cachedRoutine) {
      console.log("⚡ Cache hit (JSON):", cacheKey);
      const processingTime = Date.now() - startTime;

      return NextResponse.json(
        {
          success: true,
          data: cachedRoutine,
          databaseSaved: false,
          metadata: {
            totalProducts: allProducts.length,
            analyzedProducts: allProducts.length,
            processingTime,
            source: 'cache',
          }
        },
        {
          status: 200,
          headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' }
        }
      );
    }

    console.log('🤖 Generating skincare routine (non-streaming)...');
    const routine = await generateSkincareRoutine(
      allProducts,
      skinType,
      skinConcern,
      commitmentLevel,
      preferredProducts
    );

    if (!routine) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate routine', processingTime: Date.now() - startTime },
        { status: 500 }
      );
    }

    // Save to database (best effort)
    let savedDocument = null;
    try {
      savedDocument = await saveRoutineToDatabase(
        skinType,
        skinConcern,
        'standard',
        JSON.stringify(routine)
      );
    } catch (dbError) {
      console.error('❌ Database save error:', dbError);
    }

    const processingTime = Date.now() - startTime;
    console.log(`✅ Routine generated successfully in ${processingTime}ms`);

    return NextResponse.json(
      {
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
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' }
      }
    );
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error('❌ Error in generate-routine API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error', processingTime },
      { status: 500 }
    );
  }
}
