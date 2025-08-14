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

interface FetchResponse {
  success: boolean;
  products?: ProductData[];
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

export async function fetchAllProducts(
  limit: number = 100,
  offset: number = 0
): Promise<FetchResponse> {
  try {
    const { database } = await createAdminClient();
    // Fetch documents from Appwrite
    const response = await database.listDocuments(
      DATABASE_ID!,
      PRODUCTS_COLLECTION_ID!,
      [
        Query.limit(limit),
        Query.offset(offset),
        Query.orderDesc('createdAt') // Order by creation date, newest first
      ]
    );

    const products: ProductData[] = response.documents.map((doc) => ({
      url: doc.url,
      title: doc.title,
      currency: doc.currency,
      currentPrice: doc.currentPrice,
      originalPrice: doc.originalPrice,
      discountRate: doc.discountRate,
      category: doc.category,
      rating: doc.rating,
      reviewsCount: doc.reviewsCount,
      stars: doc.stars,
      image: doc.image,
      description: doc.description
    }));

    return {
      success: true,
      products
    };

  } catch (error: unknown) {
    console.error('Error fetching products:', error);
    return {
      success: false,
      error: (error as Error).message || 'Failed to fetch products'
    };
  }
}
