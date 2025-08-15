// app/api/generate-routine/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { fetchAllProductsOptimized } from '@/lib/server/products.actions'; 
import generateSkincareRoutine from '@/lib/server/gemini.action'; 
import { ProductData,GenerateRoutineRequest } from "../../../lib/types"; 

let productsCache: {
  data: ProductData[];
  timestamp: number;
  ttl: number;
} | null = null;

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache
const API_TIMEOUT = 9000; // 9 seconds timeout (under Vercel's 10s limit)

function filterAndOptimizeProducts(
  products: ProductData[],
  categories?: string[],
  priceRange?: { min: number; max: number },
): ProductData[] {
  let filtered = products;

  // Filter by categories if specified
  if (categories && categories.length > 0) {
    filtered = filtered.filter(product => 
      categories.some(category => 
        product.category.toLowerCase().includes(category.toLowerCase())
      )
    );
  }

  // Filter by price range if specified
  if (priceRange) {
    filtered = filtered.filter(product => 
      product.currentPrice >= priceRange.min && 
      product.currentPrice <= priceRange.max
    );
  }

  // Limit products for AI processing
  return filtered.slice(0);
}

/**
 * Get products with caching
 */
async function getCachedProducts(limit: number = 200): Promise<ProductData[]> {
  const now = Date.now();
  
  // Check if cache is valid
  if (productsCache && (now - productsCache.timestamp) < productsCache.ttl) {
    return productsCache.data;
  }

  // Fetch fresh data
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

async function processRoutineGeneration(
  products: ProductData[],
  skinType: string,
  skinConcern: string,
  commitmentLevel: string,
  preferredProducts: string
) {
  return new Promise(async (resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Routine generation timeout'));
    }, API_TIMEOUT);

    try {
      // Use setImmediate to yield control back to event loop
      setImmediate(async () => {
        try {
          const routine = await generateSkincareRoutine(
            products,
            skinType,
            skinConcern,
            commitmentLevel,
            preferredProducts
          );
          
          clearTimeout(timeoutId);
          resolve(routine);
        } catch (error) {
          clearTimeout(timeoutId);
          reject(error);
        }
      });
    } catch (error) {
      clearTimeout(timeoutId);
      reject(error);
    }
  });
}

function validateRequest(body: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const required = ['skinType', 'skinConcern', 'commitmentLevel', 'preferredProducts'];
  
  for (const field of required) {
    if (!body[field] || typeof body[field] !== 'string' || body[field].trim() === '') {
      errors.push(`${field} is required and must be a non-empty string`);
    }
  }
  
  if (body.categories && (!Array.isArray(body.categories) || body.categories.some((c: any) => typeof c !== 'string'))) {
    errors.push('categories must be an array of strings');
  }
  
  if (body.priceRange && (
    typeof body.priceRange !== 'object' ||
    typeof body.priceRange.min !== 'number' ||
    typeof body.priceRange.max !== 'number' ||
    body.priceRange.min < 0 ||
    body.priceRange.max < body.priceRange.min
  )) {
    errors.push('priceRange must have valid min and max numbers');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
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
      categories,
      priceRange
    } = body;

    // Step 1: Fetch products (with caching)
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

    // Step 2: Filter and optimize products for AI
    // console.log('🔄 Filtering products...');
    // const optimizedProducts = filterAndOptimizeProducts(
    //   allProducts,
    //   categories,
    //   priceRange,
    // );

    // console.log(`📊 Processing ${optimizedProducts.length} products for AI analysis`);

    // Step 3: Generate routine (non-blocking)
    console.log('🤖 Generating skincare routine...');
    const routine = await processRoutineGeneration(
      allProducts,
      skinType,
      skinConcern,
      commitmentLevel,
      preferredProducts
    );

    const processingTime = Date.now() - startTime;
    console.log(`✅ Routine generated successfully in ${processingTime}ms`);

    // Return success response
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
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', // 5min cache, 10min stale
        }
      }
    );

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error('❌ Error in generate-routine API:', error);
    
    // Handle specific error types
    if (error.message === 'Routine generation timeout') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Request timeout - please try again with fewer parameters',
          processingTime
        },
        { status: 408 }
      );
    }

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

// Optional: GET method for health check
// export async function GET() {
//   return NextResponse.json(
//     {
//       success: true,
//       message: 'Skincare routine API is running',
//       timestamp: new Date().toISOString(),
//       cacheStatus: productsCache ? {
//         hasCache: true,
//         age: Date.now() - productsCache.timestamp,
//         itemCount: productsCache.data.length
//       } : { hasCache: false }
//     },
//     { status: 200 }
//   );
// }

export const runtime = 'nodejs'; 
export const maxDuration = 10; 