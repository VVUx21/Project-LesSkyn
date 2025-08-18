import { NextRequest, NextResponse } from 'next/server';
import { fetchAllProductsOptimized } from '@/lib/server/products.actions'; 
import generateSkincareRoutine, { generateSkincareRoutineStream } from '@/lib/server/gemini.action'; 
import { ProductData, GenerateRoutineRequest } from "../../../lib/types";
import { saveRoutineToDatabase } from '@/lib/utils';

let productsCache: {
  data: ProductData[];
  timestamp: number;
  ttl: number;
} | null = null;

const CACHE_TTL = 5 * 60 * 1000; 

async function getCachedProducts(limit: number = 200): Promise<ProductData[]> {
  const now = Date.now();

  if (productsCache && (now - productsCache.timestamp) < productsCache.ttl) {
    return productsCache.data;
  }

  const response = await fetchAllProductsOptimized(limit, 0);

  if (!response.success) {
    throw new Error(response.error || 'Failed to fetch products');
  }

  productsCache = {
    data: response.products ?? [],
    timestamp: now,
    ttl: CACHE_TTL
  };

  return response.products ?? [];
}

function validateRequest(body: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const required = ['skinType', 'skinConcern', 'commitmentLevel', 'preferredProducts']; 
  
  for (const field of required) {
    if (!body[field] || typeof body[field] !== 'string' || body[field].trim() === '') {
      errors.push(`${field} is required and must be a non-empty string`);
    }
  }
   
  return {
    isValid: errors.length === 0,
    errors
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const url = new URL(request.url);
  const streaming = url.searchParams.get('stream') === 'true';

  try {
    let body: GenerateRoutineRequest
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid JSON in request body',
          processingTime: Date.now() - startTime
        },
        { status: 400 }
      );
    }

    const validation = validateRequest(body);
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Validation failed', 
          details: validation.errors,
          processingTime: Date.now() - startTime
        },
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

    console.log('🔄 Fetching products...');
    const allProducts = await getCachedProducts(limit);

    if (allProducts.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No products available for routine generation',
          processingTime: Date.now() - startTime
        },
        { status: 404 }
      );
    }

    // Handle streaming vs non-streaming
    if (streaming) {
      console.log('🌊 Starting streaming routine generation...');
      
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          let completeRoutineData: any = null;
          
          try {
            // Send initial metadata
            const metadata = {
              type: 'metadata',
              data: {
                totalProducts: allProducts.length,
                analyzedProducts: allProducts.length,
                startTime: Date.now(),
                cached: productsCache ? (Date.now() - productsCache.timestamp) < CACHE_TTL : false
              }
            };
            
            console.log('🚀 STREAMING START:', metadata);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(metadata)}\n\n`));

            // Stream the routine generation
            const routineStream = generateSkincareRoutineStream(
              allProducts,
              skinType,
              skinConcern,
              commitmentLevel,
              preferredProducts
            );

            for await (const chunk of routineStream) {
              const data = JSON.parse(chunk);
              
              console.log('📦 STREAMING CHUNK:', data.type, data);
              
              // Forward the chunk to client
              controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
              
              // If complete, save to database
              if (data.type === 'complete') {
                  completeRoutineData = data.data;
                  
                  const jsonString = JSON.stringify(data);
                  const chunkSize = 1024; // 1KB chunks
                  
                  if (jsonString.length > chunkSize) {
                    
                    for (let i = 0; i < jsonString.length; i += chunkSize) {
                      const chunk = jsonString.slice(i, i + chunkSize);
                      const isLast = i + chunkSize >= jsonString.length;
                      
                      // Send each chunk with metadata
                      const chunkData = {
                        type: 'chunk',           // Tells frontend this is a piece of data
                        data: chunk,             // The actual JSON piece
                        isComplete: isLast,      // Is this the final chunk?
                        chunkIndex: Math.floor(i / chunkSize)  // Order number (0, 1, 2...)
                      };
                      
                      // Send this chunk via Server-Sent Events
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunkData)}\n\n`));
                      
                      // Small delay to prevent overwhelming the connection
                      await new Promise(resolve => setTimeout(resolve, 10));
                    }
                    
                    // === COMPLETION SIGNAL ===
                    // After ALL chunks are sent, send a final "assembly complete" signal
                    const finalSignal = { 
                      type: 'complete_assembled'  // Special signal: "all chunks sent, assemble them now"
                    };
                    
                    // This tells the frontend: "I've sent all the pieces, put them together!"
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalSignal)}\n\n`));
                    
                  } else {
                    // === DIRECT SEND (for small data) ===
                    // If data is small enough, send it directly without chunking
                    controller.enqueue(encoder.encode(`data: ${jsonString}\n\n`));
                  }
                try {
                  await saveRoutineToDatabase(
                    skinType,
                    skinConcern,
                    commitmentLevel,
                    JSON.stringify(completeRoutineData) // Store as JSON string
                  );
                  
                  // Send success confirmation to client
                  const saveConfirmation = {
                    type: 'database_saved',
                    message: 'Routine successfully saved to database'
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(saveConfirmation)}\n\n`));
                  
                } catch (dbError) {
                  console.error('❌ Database save error:', dbError);
                  const dbErrorMessage = {
                    type: 'database_error',
                    error: 'Failed to save routine to database'
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(dbErrorMessage)}\n\n`));
                }
                
                const processingTime = Date.now() - startTime;
                console.log('✅ STREAMING COMPLETE:', { processingTime, type: data.type });
                
                const finalMessage = {
                  type: 'metadata',
                  data: { processingTime, completed: true }
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalMessage)}\n\n`));
                break;
              }
              
              if (data.type === 'error') {
                if (completeRoutineData) {
                  try {
                    await saveRoutineToDatabase(
                      skinType,
                      skinConcern,
                      'streaming_error',
                      JSON.stringify({ error: data.error, partialData: completeRoutineData })
                    );
                  } catch (dbError) {
                    console.error('❌ Database save error on stream error:', dbError);
                  }
                }
                break;
              }
            }
          } catch (error: any) {
            console.error('❌ STREAMING ERROR:', error);
            const errorMessage = {
              type: 'error',
              error: error.message || 'Stream processing failed'
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorMessage)}\n\n`));
          } finally {
            console.log('🔚 STREAMING ENDED');
            controller.close();
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
    } else {
      // Non-streaming (original behavior)
      console.log('🤖 Generating skincare routine...');
      const routine = await generateSkincareRoutine(
        allProducts,
        skinType,
        skinConcern,
        commitmentLevel,
        preferredProducts
      );

      if (!routine) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Failed to generate routine',
            processingTime: Date.now() - startTime
          },
          { status: 500 }
        );
      }

      // Save to database
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
        // Still return the routine even if database save fails
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
            cached: productsCache ? (Date.now() - productsCache.timestamp) < CACHE_TTL : false
          }
        },
        { 
          status: 200,
          headers: {
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          }
        }
      );
    }
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error('❌ Error in generate-routine API:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Internal server error',
        processingTime
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';