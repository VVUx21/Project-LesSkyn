// context/skin-care-context.tsx
"use client"
import React, { createContext, useContext, useReducer, useCallback } from 'react'

export type SkinType = "Feels tight, may have flaky patches, rarely gets oily" 
| "Shiny appearance, enlarged pores, prone to breakouts" | "Oily T-zone (forehead, nose, chin) but dry cheeks" | "Well-balanced, not too oily or dry, few imperfections"
 | "Easily irritated, may react to products with redness"
export type SkinConcern = "Pimples, blackheads, whiteheads, and clogged pores" | "Fine lines, wrinkles, loss of firmness and elasticity" | "Lack of radiance, rough texture, uneven skin tone"
 | "Sun spots, post-acne marks, melasma, uneven skin tone" | "Irritation, redness, reactivity to products"
export type RoutineType = "A simple, no-fuss routine with just the essentials 3-4 steps" | "A balanced routine with targeted treatments 5-6 steps" | 
"A complete routine for maximum results 7+ steps"

// Types
interface RoutineStep {
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

interface SkincareRoutine {
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

interface RoutineMetadata {
  totalProducts: number;
  analyzedProducts: number;
  processingTime: number;
  cached: boolean;
  generatedAt: string;
}

interface UserProfile {
  // Existing profile fields
  currentStep: number;
  skinType: string;
  skinConcern: string;
  routineType: string;
  faceScanImage?: string;
  
  // Enhanced fields for routine generation
  generatedRoutine?: SkincareRoutine;
  routineGenerationHistory: Array<{
    timestamp: string;
    parameters: {
      skinType: string;
      skinConcern: string;
      commitmentLevel: string;
      preferredProducts: string;
    };
    success: boolean;
    error?: string;
  }>;
  
  // User preferences
  preferences: {
    budgetRange: { min: number; max: number };
    ingredientAllergies: string[];
    brandPreferences: string[];
    avoidIngredients: string[];
  };
  
  // Progress tracking
  onboardingCompleted: boolean;
  routineGenerationAttempts: number;
  lastActivityTimestamp: string;
}

// Initial state
const initialUserProfile: UserProfile = {
  currentStep: 0,
  skinType: "",
  skinConcern: "",
  routineType: "",
  faceScanImage: undefined,
  generatedRoutine: undefined,
  routineGenerationHistory: [],
  preferences: {
    budgetRange: { min: 10, max: 100 },
    ingredientAllergies: [],
    brandPreferences: [],
    avoidIngredients: []
  },
  onboardingCompleted: false,
  routineGenerationAttempts: 0,
  lastActivityTimestamp: new Date().toISOString()
}

// Action types
type SkinCareAction = 
  | { type: 'UPDATE_PROFILE'; payload: Partial<UserProfile> }
  | { type: 'SET_GENERATED_ROUTINE'; payload: { routine: SkincareRoutine; metadata: RoutineMetadata } }
  | { type: 'ADD_ROUTINE_HISTORY'; payload: UserProfile['routineGenerationHistory'][0] }
  | { type: 'UPDATE_PREFERENCES'; payload: Partial<UserProfile['preferences']> }
  | { type: 'INCREMENT_GENERATION_ATTEMPTS' }
  | { type: 'RESET_PROFILE' }
  | { type: 'COMPLETE_ONBOARDING' }
  | { type: 'UPDATE_ACTIVITY_TIMESTAMP' }

// Reducer
function skinCareReducer(state: UserProfile, action: SkinCareAction): UserProfile {
  switch (action.type) {
    case 'UPDATE_PROFILE':
      return {
        ...state,
        ...action.payload,
        lastActivityTimestamp: new Date().toISOString()
      }
    
    case 'SET_GENERATED_ROUTINE':
      return {
        ...state,
        generatedRoutine: action.payload.routine,
        lastActivityTimestamp: new Date().toISOString()
      }
    
    case 'ADD_ROUTINE_HISTORY':
      return {
        ...state,
        routineGenerationHistory: [
          action.payload,
          ...state.routineGenerationHistory.slice(0, 9) // Keep last 10 attempts
        ],
        lastActivityTimestamp: new Date().toISOString()
      }
    
    case 'UPDATE_PREFERENCES':
      return {
        ...state,
        preferences: {
          ...state.preferences,
          ...action.payload
        },
        lastActivityTimestamp: new Date().toISOString()
      }
    
    case 'INCREMENT_GENERATION_ATTEMPTS':
      return {
        ...state,
        routineGenerationAttempts: state.routineGenerationAttempts + 1,
        lastActivityTimestamp: new Date().toISOString()
      }
    
    case 'COMPLETE_ONBOARDING':
      return {
        ...state,
        onboardingCompleted: true,
        lastActivityTimestamp: new Date().toISOString()
      }
    
    case 'UPDATE_ACTIVITY_TIMESTAMP':
      return {
        ...state,
        lastActivityTimestamp: new Date().toISOString()
      }
    
    case 'RESET_PROFILE':
      return {
        ...initialUserProfile,
        lastActivityTimestamp: new Date().toISOString()
      }
    
    default:
      return state
  }
}

// Context type
interface SkinCareContextType {
  userProfile: UserProfile;
  updateUserProfile: (updates: Partial<UserProfile>) => void;
  setGeneratedRoutine: (routine: SkincareRoutine, metadata: RoutineMetadata) => void;
  addRoutineHistory: (historyEntry: UserProfile['routineGenerationHistory'][0]) => void;
  updatePreferences: (preferences: Partial<UserProfile['preferences']>) => void;
  incrementGenerationAttempts: () => void;
  completeOnboarding: () => void;
  resetProfile: () => void;
  
  // Computed properties
  hasGeneratedRoutine: boolean;
  canRetryGeneration: boolean;
  isOnboardingComplete: boolean;
  lastGenerationAttempt?: UserProfile['routineGenerationHistory'][0];
}

// Create context
const SkinCareContext = createContext<SkinCareContextType | undefined>(undefined)

// Provider component
interface SkinCareProviderProps {
  children: React.ReactNode;
  persistKey?: string; // Optional localStorage key for persistence
}

export function SkinCareProvider({ children, persistKey = 'skincare_profile' }: SkinCareProviderProps) {
  // Load initial state from localStorage if available
  const loadInitialState = (): UserProfile => {
    if (typeof window === 'undefined') return initialUserProfile;
    
    try {
      const saved = localStorage.getItem(persistKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with initial state to handle schema changes
        return { ...initialUserProfile, ...parsed };
      }
    } catch (error) {
      console.warn('Failed to load saved profile:', error);
    }
    
    return initialUserProfile;
  };

  const [userProfile, dispatch] = useReducer(skinCareReducer, loadInitialState());

  // Save to localStorage whenever state changes
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(persistKey, JSON.stringify(userProfile));
    } catch (error) {
      console.warn('Failed to save profile:', error);
    }
  }, [userProfile, persistKey]);

  // Action creators
  const updateUserProfile = useCallback((updates: Partial<UserProfile>) => {
    dispatch({ type: 'UPDATE_PROFILE', payload: updates });
  }, []);

  const setGeneratedRoutine = useCallback((routine: SkincareRoutine, metadata: RoutineMetadata) => {
    dispatch({ type: 'SET_GENERATED_ROUTINE', payload: { routine, metadata } });
    dispatch({ type: 'COMPLETE_ONBOARDING' });
  }, []);

  const addRoutineHistory = useCallback((historyEntry: UserProfile['routineGenerationHistory'][0]) => {
    dispatch({ type: 'ADD_ROUTINE_HISTORY', payload: historyEntry });
  }, []);

  const updatePreferences = useCallback((preferences: Partial<UserProfile['preferences']>) => {
    dispatch({ type: 'UPDATE_PREFERENCES', payload: preferences });
  }, []);

  const incrementGenerationAttempts = useCallback(() => {
    dispatch({ type: 'INCREMENT_GENERATION_ATTEMPTS' });
  }, []);

  const completeOnboarding = useCallback(() => {
    dispatch({ type: 'COMPLETE_ONBOARDING' });
  }, []);

  const resetProfile = useCallback(() => {
    dispatch({ type: 'RESET_PROFILE' });
    // Clear localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(persistKey);
      } catch (error) {
        console.warn('Failed to clear saved profile:', error);
      }
    }
  }, [persistKey]);

  // Computed properties
  const hasGeneratedRoutine = Boolean(userProfile.generatedRoutine);
  const canRetryGeneration = userProfile.routineGenerationAttempts < 5; // Limit retries
  const isOnboardingComplete = userProfile.onboardingCompleted;
  const lastGenerationAttempt = userProfile.routineGenerationHistory[0];

  const contextValue: SkinCareContextType = {
    userProfile,
    updateUserProfile,
    setGeneratedRoutine,
    addRoutineHistory,
    updatePreferences,
    incrementGenerationAttempts,
    completeOnboarding,
    resetProfile,
    hasGeneratedRoutine,
    canRetryGeneration,
    isOnboardingComplete,
    lastGenerationAttempt
  };

  return (
    <SkinCareContext.Provider value={contextValue}>
      {children}
    </SkinCareContext.Provider>
  )
}

// Hook to use the context
export function useSkinCare() {
  const context = useContext(SkinCareContext);
  if (context === undefined) {
    throw new Error('useSkinCare must be used within a SkinCareProvider');
  }
  return context;
}

export default SkinCareContext;