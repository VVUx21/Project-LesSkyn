"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

export type SkinType = "Feels tight, may have flaky patches, rarely gets oily" 
| "Shiny appearance, enlarged pores, prone to breakouts" | "Oily T-zone (forehead, nose, chin) but dry cheeks" | "Well-balanced, not too oily or dry, few imperfections"
 | "Easily irritated, may react to products with redness"
export type SkinConcern = "Pimples, blackheads, whiteheads, and clogged pores" | "Fine lines, wrinkles, loss of firmness and elasticity" | "Lack of radiance, rough texture, uneven skin tone"
 | "Sun spots, post-acne marks, melasma, uneven skin tone" | "Irritation, redness, reactivity to products"
export type RoutineType = "A simple, no-fuss routine with just the essentials 3-4 steps" | "A balanced routine with targeted treatments 5-6 steps" | 
"A complete routine for maximum results 7+ steps"

export interface UserProfile {
  skinType?: SkinType
  skinConcern?: SkinConcern
  routineType?: RoutineType
  faceScanImage?: string
  currentStep: number
  completedOnboarding: boolean
}

export interface Product {
  id: string
  name: string
  description: string
  imageUrl: string
  price: string
  category: "cleanser" | "toner" | "serum" | "moisturizer" | "sunscreen" | "mask" | "exfoliator"
  forSkinTypes: SkinType[]
  forSkinConcerns: SkinConcern[]
  amazonUrl?: string
  available: boolean
}

export interface RoutineStep {
  id: string
  name: string
  description: string
  timeOfDay: "AM" | "PM" | "both"
  productId: string
}

interface SkinCareContextType {
  userProfile: UserProfile
  updateUserProfile: (updates: Partial<UserProfile>) => void
  resetUserProfile: () => void
}

const defaultUserProfile: UserProfile = {
  currentStep: 0,
  completedOnboarding: false,
}

const SkinCareContext = createContext<SkinCareContextType | undefined>(undefined)

export function SkinCareProvider({ children }: { children: ReactNode }) {
  const [userProfile, setUserProfile] = useState<UserProfile>(defaultUserProfile)

  const updateUserProfile = (updates: Partial<UserProfile>) => {
    setUserProfile((prev) => ({ ...prev, ...updates }))
  }

  const resetUserProfile = () => {
    setUserProfile(defaultUserProfile)
  }

  return (
    <SkinCareContext.Provider
      value={{
        userProfile,
        updateUserProfile,
        resetUserProfile,
      }}
    >
      {children}
    </SkinCareContext.Provider>
  )
}

export function useSkinCare() {
  const context = useContext(SkinCareContext)
  if (context === undefined) {
    throw new Error("useSkinCare must be used within a SkinCareProvider")
  }
  return context
}
