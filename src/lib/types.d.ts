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

export interface RoutineStep {
  stepNumber: number;
  stepName: string;
  product: {
    productName: string;
    productLink: string;
    description: string;
    price: number;
    currency: string;
    source: string;
  };
  whyThisProduct: string;
  howToUse: string;
}

export interface SkincareRoutine {
  morningRoutine: {
    step1Cleanser: RoutineStep;
    step2Serum?: RoutineStep;
    step3Moisturizer: RoutineStep;
    step4Sunscreen: RoutineStep;
  };
  eveningRoutine: {
    step1Cleanser: RoutineStep;
    step2Treatment: RoutineStep;
    step3Moisturizer: RoutineStep;
    step4NightCare?: RoutineStep;
  };
  weeklyTreatments?: {
    treatment: string;
    frequency: string;
    recommendedProducts: Array<{
      productName: string;
      productLink: string;
      description: string;
      price: number;
      whyRecommended: string;
    }>;
  };
  routineNotes: string[];
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
