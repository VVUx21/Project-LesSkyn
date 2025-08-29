export interface ProductData {
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

export interface GenerateRoutineRequest {
  skinType: string;
  skinConcern: string;
  commitmentLevel: string;
  preferredProducts: string;
  limit?: number;
  categories?: string[];
  priceRange?: {
    min: number;
    max: number;
  };
}

export interface SkincareRoutineRequest {
  skinType: string;
  skinConcern: string;
  commitmentLevel: string;
  preferredProducts: string;
  limit?: number;
  categories?: string[];
  priceRange?: {
    min: number;
    max: number;
  };
}

export interface SkincareRoutineResponse {
  success: boolean;
  data?: any;
  error?: string;
  details?: string[];
  metadata?: {
    totalProducts: number;
    analyzedProducts: number;
    processingTime: number;
    cached: boolean;
  };
  processingTime?: number;
}

export interface RoutineStep {
  step: number;
  product_name: string;
  product_url: string;
  reasoning: string;
  how_to_use: string;
}

export interface WeeklyTreatment {
  treatment_type: string;
  recommendation: string;
  how_to_use: string;
}

export interface SkincareData {
  routine: {
    morning: RoutineStep[];
    evening: RoutineStep[];
  };
  weekly_treatments: WeeklyTreatment[];
  general_notes_and_tips: string[];
}

export interface UserPreferences {
  skinType: string;
  skinConcern: string;
}

export interface GetRoutineResponse {
  success: boolean;
  data?: SkincareData;
  error?: string;
  message?: string;
}
