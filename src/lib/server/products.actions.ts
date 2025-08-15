'use server';
import { ID, Query } from "node-appwrite";
import { createAdminClient} from "./appwrite";
const {
  APPWRITE_DATABASE_ID: DATABASE_ID,
  APPWRITE_PRODUCTS_COLLECTION_ID: PRODUCTS_COLLECTION_ID,
} = process.env;

// ProductData interface
interface ProductData {
  url: string;
  title: string;
  currency: string;
  currentPrice: number;
  originalPrice: number;
  discountRate: number;
  category: string;
  reviewsCount: number;
  stars?: number;
  image: string;
  description: string;
}

// Response interfaces
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
      ID.unique(), // Auto-generate document ID
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

// Enhanced version of fetchAllProducts with optimizations
export async function fetchAllProductsOptimized(
  limit: number = 200,
  offset: number = 0,
  categories?: string[],
  priceRange?: { min: number; max: number }
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

    if (priceRange) {
      queries.push(Query.greaterThanEqual('currentPrice', priceRange.min));
      queries.push(Query.lessThanEqual('currentPrice', priceRange.max));
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
    // Execute the query
    const response = await database.listDocuments(
      DATABASE_ID!,
      PRODUCTS_COLLECTION_ID!,
      queries
    );

    // Transform documents to ProductData format
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