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

interface UserProfile {
  currentStep: number;
  skinType: string;
  skinConcern: string;
  routineType: string;
  faceScanImage?: string;
  generatedRoutine?: any;
}

// Initial state
const initialUserProfile: UserProfile = {
  currentStep: 0,
  skinType: "",
  skinConcern: "",
  routineType: "",
  faceScanImage: undefined
}

// Action types
type SkinCareAction = { type: 'UPDATE_PROFILE'; payload: Partial<UserProfile> }

// Reducer
function skinCareReducer(state: UserProfile, action: SkinCareAction): UserProfile {
  return { ...state, ...action.payload }
}

// Context type
interface SkinCareContextType {
  userProfile: UserProfile;
  updateUserProfile: (updates: Partial<UserProfile>) => void;
}

// Create context
const SkinCareContext = createContext<SkinCareContextType | undefined>(undefined)

// Provider component
interface SkinCareProviderProps {
  children: React.ReactNode;
  persistKey?: string;
}

export function SkinCareProvider({ children, persistKey = 'skincare_profile' }: SkinCareProviderProps) {
  // Load initial state from localStorage if available
  const loadInitialState = (): UserProfile => {
    if (typeof window === 'undefined') return initialUserProfile;
    
    try {
      const saved = localStorage.getItem(persistKey);
      if (saved) {
        const parsed = JSON.parse(saved);
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

  // Action creator
  const updateUserProfile = useCallback((updates: Partial<UserProfile>) => {
    dispatch({ type: 'UPDATE_PROFILE', payload: updates });
  }, []);

  const contextValue: SkinCareContextType = {
    userProfile,
    updateUserProfile
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