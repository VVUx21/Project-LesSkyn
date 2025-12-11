export const mapSkinTypeToAPI = (skinType: string): string => {
  const mapping: Record<string, string> = {
    "Oily T-zone (forehead, nose, chin) but dry cheeks": "Combination",
    "Shiny appearance, enlarged pores, prone to breakouts": "Oily",
    "Well-balanced, not too oily or dry, few imperfections": "Normal",
    "Feels tight, may have flaky patches, rarely gets oily": "Dry",
    "Easily irritated, may react to products with redness": "Sensitive"
  };
  return mapping[skinType] || "Normal";
};

export const mapSkinConcernToAPI = (skinConcern: string): string => {
  const mapping: Record<string, string> = {
    "Pimples, blackheads, whiteheads, and clogged pores": "Clear Acne & Breakouts",
    "Fine lines, wrinkles, loss of firmness and elasticity": "Anti-aging",
    "Lack of radiance, rough texture, uneven skin tone": "Achieve a Natural Glow",
    "Sun spots, post-acne marks, melasma, uneven skin tone": "Even Out Skin Tone & Reduce Dark Spots",
    "Irritation, redness, reactivity to products": "Reduce Redness & Sensitivity"
  };
  return mapping[skinConcern] || "Not specified";
};

export const mapRoutineTypeToAPI = (routineType: string): string => {
  const mapping: Record<string, string> = {
    "A simple, no-fuss routine with just the essentials 3-4 steps": "Minimal",
    "A balanced routine with targeted treatments 5-6 steps": "Standard",
    "A complete routine for maximum results 7+ steps": "Comprehensive"
  };
  return mapping[routineType] || "Standard";
};

// ===== DISPLAY LABEL MAPPERS (API format → User-friendly) =====

export const getSkinTypeLabel = (skinType: string): string => {
  const labels: Record<string, string> = {
    "Oily T-zone (forehead, nose, chin) but dry cheeks": "Combination",
    "Shiny appearance, enlarged pores, prone to breakouts": "Oily",
    "Well-balanced, not too oily or dry, few imperfections": "Normal",
    "Feels tight, may have flaky patches, rarely gets oily": "Dry",
    "Easily irritated, may react to products with redness": "Sensitive"
  };
  return labels[skinType] || "Not specified";
};

export const getSkinConcernLabel = (skinConcern: string): string => {
  const labels: Record<string, string> = {
    "Pimples, blackheads, whiteheads, and clogged pores": "Clear Acne & Breakouts",
    "Fine lines, wrinkles, loss of firmness and elasticity": "Anti-aging",
    "Lack of radiance, rough texture, uneven skin tone": "Achieve a Natural Glow",
    "Sun spots, post-acne marks, melasma, uneven skin tone": "Even Out Skin Tone & Reduce Dark Spots",
    "Irritation, redness, reactivity to products": "Reduce Redness & Sensitivity"
  };
  return labels[skinConcern] || "Not specified";
};

export const getRoutineTypeLabel = (routineType: string): string => {
  const labels: Record<string, string> = {
    "A simple, no-fuss routine with just the essentials 3-4 steps": "Minimal",
    "A balanced routine with targeted treatments 5-6 steps": "Standard",
    "A complete routine for maximum results 7+ steps": "Comprehensive"
  };
  return labels[routineType] || "Not specified";
};

// ===== HELPER FUNCTIONS =====

export const determinePreferredProducts = (routineType: string): string => {
  if (routineType === "A complete routine for maximum results 7+ steps") {
    return "Budget-Friendly + Natural/Organic Products";
  }
  return "Natural/Organic Products";
};

export const getRelevantCategories = (skinConcern: string): string[] => {
  const baseCategories = ["cleansers", "moisturizers", "serum", "facewash"];
  const concernCategories: Record<string, string[]> = {
    "Pimples, blackheads, whiteheads, and clogged pores": ["acne treatments", "serums", "toners"],
    "Fine lines, wrinkles, loss of firmness and elasticity": ["anti-aging", "serums", "retinoids", "peptides"],
    "Lack of radiance, rough texture, uneven skin tone": ["exfoliants", "serums", "vitamin c", "brightening"],
    "Sun spots, post-acne marks, melasma, uneven skin tone": ["brightening", "vitamin c", "niacinamide", "serums"],
    "Irritation, redness, reactivity to products": ["sensitive skin", "gentle", "hydrating serums"]
  };
  return [...baseCategories, ...(concernCategories[skinConcern] || [])];
};

// ===== REQUEST PAYLOAD BUILDER =====

export interface RoutineRequestPayload {
  sessionId: string;
  skinType: string;
  skinConcern: string;
  commitmentLevel: string;
  preferredProducts: string;
  limit: number;
  categories?: string[];
  priceRange?: {
    min: number;
    max: number;
  };
}

export const buildRoutineRequestPayload = (
  sessionId: string,
  skinType: string,
  skinConcern: string,
  routineType: string,
  limit: number = 150
): RoutineRequestPayload => {
  return {
    sessionId,
    skinType: mapSkinTypeToAPI(skinType),
    skinConcern: mapSkinConcernToAPI(skinConcern),
    commitmentLevel: mapRoutineTypeToAPI(routineType),
    preferredProducts: determinePreferredProducts(routineType),
    limit,
    categories: getRelevantCategories(skinConcern),
    priceRange: {
      min: 5,
      max: routineType === "A complete routine for maximum results 7+ steps" ? 150 : 80
    }
  };
};

// ===== LOADING STATES =====

export const LOADING_STATES = [
  { text: "Searching for your personalized routine..." },
  { text: "AI is crafting your perfect skincare plan..." },
  { text: "Analyzing product combinations..." },
  { text: "Fine-tuning morning and evening routines..." },
  { text: "Almost ready - finalizing recommendations..." },
];
