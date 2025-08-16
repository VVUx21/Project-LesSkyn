import { NextRequest, NextResponse } from 'next/server';
import { fetchAllProductsOptimized } from '@/lib/server/products.actions'; 
import generateSkincareRoutine, { generateSkincareRoutineStream } from '@/lib/server/gemini.action'; 
import { ProductData,GenerateRoutineRequest } from "../../../lib/types"; 

let productsCache: {
  data: ProductData[];
  timestamp: number;
  ttl: number;
} | null = null;

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

async function getCachedProducts(limit: number = 200): Promise<ProductData[]> {
  const now = Date.now();

  if (productsCache && (now - productsCache.timestamp) < productsCache.ttl) {
    return productsCache.data;
  }

  const response = await fetchAllProductsOptimized(limit, 0);

  if (!response.success) {
    throw new Error(response.error || 'Failed to fetch products');
  }

  // Update cache
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

// New streaming endpoint
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const url = new URL(request.url);
  const streaming = url.searchParams.get('stream') === 'true';
  
  try {
    // Parse request body
    let body: GenerateRoutineRequest;
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

    // Validate request
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

    // Fetch products (with caching)
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
      
      // Create a ReadableStream for Server-Sent Events
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          
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
            
            console.log('🚀 STREAMING START:', metadata); // ADD THIS
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
              
              console.log('📦 STREAMING CHUNK:', data.type, data); // ADD THIS
              
              // Forward the chunk to client
              controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
              
              // If complete or error, close the stream
              if (data.type === 'complete' || data.type === 'error') {
                const processingTime = Date.now() - startTime;
                console.log('✅ STREAMING COMPLETE:', { processingTime, type: data.type }); // ADD THIS
                
                const finalMessage = {
                  type: 'metadata',
                  data: { processingTime, completed: true }
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalMessage)}\n\n`));
                break;
              }
            }
          } catch (error: any) {
            console.error('❌ STREAMING ERROR:', error); // ADD THIS
            const errorMessage = {
              type: 'error',
              error: error.message || 'Stream processing failed'
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorMessage)}\n\n`));
          } finally {
            console.log('🔚 STREAMING ENDED'); // ADD THIS
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

      const processingTime = Date.now() - startTime;
      console.log(`✅ Routine generated successfully in ${processingTime}ms`);

      return NextResponse.json(
        {
          success: true,
          data: routine,
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
export const maxDuration = 60;