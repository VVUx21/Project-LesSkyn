'use server';
import { ID, Query } from "node-appwrite";
import { createAdminClient} from "./appwrite";
import { ProductData} from "../types";
import { client } from '../server/redis';
const {
  APPWRITE_DATABASE_ID: DATABASE_ID,
  APPWRITE_PRODUCTS_COLLECTION_ID: PRODUCTS_COLLECTION_ID,
} = process.env;

interface UploadResponse {
  success: boolean;
  error?: string;
}

export async function uploadProductData(productData: ProductData): Promise<UploadResponse> {
  try {
    if (!productData.url || !productData.title || !productData.currency) {
      return {
        success: false,
        error: 'Missing required fields: url, title, and currency are required'
      };
    }
    const { database } = await createAdminClient();
    const document = await database.createDocument(
      DATABASE_ID!,
      PRODUCTS_COLLECTION_ID!,
      ID.unique(),
      {
        url: productData.url,
        title: productData.title,
        currency: productData.currency,
        currentPrice: productData.currentPrice,
        originalPrice: productData.originalPrice,
        discountRate: productData.discountRate,
        category: productData.category,
        reviewsCount: productData.reviewsCount,
        stars: productData.stars || null,
        image: productData.image,
        description: productData.description,
        createdAt: new Date().toISOString(),
      }
    );

    return {
      success: true,
    };

  } catch (error: unknown) {
    console.error('Error uploading product data:', error);
    return {
      success: false,
      error: (error as Error).message || 'Failed to upload product data',
    };
  }
}

interface FetchResponse {
  success: boolean;
  products: ProductData[];
  error?: string;
  totalCount?: number;
}

export async function fetchAllProductsOptimized(
  limit: number = 200,
  offset: number = 0,
  categories?: string[],
): Promise<FetchResponse> {
  try {
    const queries: string[] = [
      Query.limit(Math.min(limit, 1000)), // Appwrite has a max limit
      Query.offset(offset),
      Query.orderDesc('discountRate') // Then by discount
    ];

    if (categories && categories.length > 0) {
      const categoryQueries = categories.map(category => 
        Query.contains('category', category)
      );
      queries.push(Query.or(categoryQueries));
    }

    queries.push(Query.select([
      'url',
      'title', 
      'currency',
      'currentPrice',
      'originalPrice',
      'discountRate',
      'category',
      'reviewsCount',
      'stars',
      'image',
      'description'
    ]));

    console.log(`🔍 Executing database query with ${queries.length} conditions`);
    const {database} = await createAdminClient();
    const response = await database.listDocuments(
      DATABASE_ID!,
      PRODUCTS_COLLECTION_ID!,
      queries
    );

    const products: ProductData[] = response.documents.map((doc: any) => ({
      url: doc.url || '',
      title: doc.title || '',
      currency: doc.currency || 'USD',
      currentPrice: parseFloat(doc.currentPrice) || 0,
      originalPrice: parseFloat(doc.originalPrice) || 0,
      discountRate: parseFloat(doc.discountRate) || 0,
      category: doc.category || '',
      reviewsCount: parseInt(doc.reviewsCount) || 0,
      stars: doc.stars ? parseFloat(doc.stars) : undefined,
      image: doc.image || '',
      description: doc.description || ''
    }));

    console.log(`✅ Fetched ${products.length} products from database`);

    return {
      success: true,
      products,
      totalCount: response.total
    };

  } catch (error: any) {
    console.error('❌ Error fetching products from database:', error);
    
    if (error.code === 401) {
      return {
        success: false,
        products: [],
        error: 'Database authentication failed'
      };
    }
    
    if (error.code === 404) {
      return {
        success: false,
        products: [],
        error: 'Database or collection not found'
      };
    }

    return {
      success: false,
      products: [],
      error: error.message || 'Failed to fetch products from database'
    };
  }
}

const CACHE_KEY = 'products_cache';
const CACHE_TTL_SECONDS = Math.floor(6000000 / 1000); // Redis TTL in seconds (100 minutes)

async function getCachedProducts(limit: number = 200): Promise<ProductData[]> {
  try {
    const cachedData = await client.get(CACHE_KEY);
    
    if (cachedData) {
      const parsedData: ProductData[] = JSON.parse(cachedData);
      console.log('Cache hit: Retrieved products from Redis');
      return parsedData;
    }

    console.log('Cache miss: Fetching fresh data');
    
    const response = await fetchAllProductsOptimized(limit, 0);

    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch products');
    }

    const products = response.products ?? [];

    await client.setex(CACHE_KEY, CACHE_TTL_SECONDS, JSON.stringify(products));
    console.log('Data cached in Redis');

    return products;
  } catch (redisError) {
    console.error('Redis error, falling back to in-memory cache:', redisError);
  }
  return [];
}

async function invalidateProductsCache(): Promise<void> {
  try {
    await client.del(CACHE_KEY);
    console.log('Products cache invalidated');
  } catch (error) {
    console.error('Error invalidating cache:', error);
  }
}

export { getCachedProducts, invalidateProductsCache };