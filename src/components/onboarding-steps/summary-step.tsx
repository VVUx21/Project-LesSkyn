"use client"
import { useSkinCare } from "@/context/skin-care-context"
//import { useUserContext } from "@/context/userstate"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"
import Image from "next/image"
import { useCallback } from "react"
import React from "react"

interface SummaryStepProps {
  onComplete: () => void
}

export default function SummaryStep({ onComplete }: SummaryStepProps) {
  const { userProfile, updateUserProfile } = useSkinCare();
  //const UserContext= useUserContext();
  //const Context = React.useContext(UserContext);
  //const User = Context?.User;

//   const handleSubmitProfile = useCallback(async () => {
//     if (!User || !User.primaryEmailAddress?.emailAddress) {
//       console.error("User or email not available")
//       return
//     }

//     const payload = {
//       ...userProfile,
//       email_id: User.primaryEmailAddress.emailAddress, 
//     }

//     try {
//       const res = await fetch("/api/user-profile", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(payload),
//       })

//       const result = await res.json()
//       if (!res.ok) throw new Error(result.error || "Something went wrong")

//       //console.log("✅ User profile updated:", result.data)
//       onComplete()
//     } catch (err) {
//       console.error("❌ Failed to submit user profile:", err)
//     }
//   }, [User, userProfile, onComplete])

  //console.log("User Profile in Summary Step:", userProfile)

  const getSkinTypeLabel = () => {
    switch (userProfile.skinType) {
      case "Oily T-zone (forehead, nose, chin) but dry cheeks":
        return "Dry"
      case "Shiny appearance, enlarged pores, prone to breakouts":
        return "Oily"
      case "Well-balanced, not too oily or dry, few imperfections":
        return "Normal"
      case "Feels tight, may have flaky patches, rarely gets oily":
        return "Combination"
      case "Easily irritated, may react to products with redness":
        return "Sensitive"
      default:
        return "Not specified"
    }
  }

  const getSkinConcernLabel = () => {
    switch (userProfile.skinConcern) {
      case "Pimples, blackheads, whiteheads, and clogged pores":
        return "Acne & Breakouts"
      case "Fine lines, wrinkles, loss of firmness and elasticity":
        return "Signs of Aging"
      case "Lack of radiance, rough texture, uneven skin tone":
        return "Dullness & Uneven Texture"
      case "Sun spots, post-acne marks, melasma, uneven skin tone":
        return "Dark Spots & Hyperpigmentation"
      case "Irritation, redness, reactivity to products":
        return "Redness & Sensitivity"
      default:
        return "Not specified"
    }
  }

  const getRoutineTypeLabel = () => {
    switch (userProfile.routineType) {
      case "A simple, no-fuss routine with just the essentials 3-4 steps":
        return "Minimal (3-4 steps)"
      case "A balanced routine with targeted treatments 5-6 steps":
        return "Standard (5-6 steps)"
      case "A complete routine for maximum results 7+ steps":
        return "Comprehensive (7+ steps)"
      default:
        return "Not specified"
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-6">
        <h3 className="mb-4 text-lg font-medium">Your Skin Profile</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="text-muted-foreground">Skin Type</span>
            <span className="font-medium">{getSkinTypeLabel()}</span>
          </div>
          <div className="flex items-center justify-between border-b pb-2">
            <span className="text-muted-foreground">Main Concern</span>
            <span className="font-medium">{getSkinConcernLabel()}</span>
          </div>
          <div className="flex items-center justify-between border-b pb-2">
            <span className="text-muted-foreground">Routine Preference</span>
            <span className="font-medium">{getRoutineTypeLabel()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Face Scan</span>
            <span className="font-medium">{userProfile.faceScanImage ? "Uploaded" : "Not uploaded"}</span>
          </div>
        </div>

        {userProfile.faceScanImage && (
          <div className="mt-4">
            <p className="mb-2 text-sm text-muted-foreground">Your uploaded face scan:</p>
            <Image
              src={userProfile.faceScanImage || "/placeholder.svg"}
              alt="Face scan"
              width={100}
              height={100}
              className="rounded-md object-cover"
            />
          </div>
        )}
      </div>

      <div className="rounded-lg bg-emerald-50 p-4 text-emerald-800">
        <div className="flex items-start gap-3">
          <Check className="mt-0.5 h-5 w-5 text-emerald-600" />
          <div>
            <p className="font-medium">You're all set!</p>
            <p className="text-sm">
              Based on your profile, we'll create a personalized skincare routine and product recommendations just for
              you.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <Button
          variant="outline"
          onClick={() => updateUserProfile({ currentStep: Math.max(0, userProfile.currentStep - 1) })}
        >
          Back
        </Button>
        <Button className="bg-[#211D39] text-amber-50">
          Get My Routine
        </Button>
      </div>
    </div>
  )
}
