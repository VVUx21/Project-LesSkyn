"use client"

import { useSkinCare, type SkinConcern } from "@/context/skin-care-context"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { HelpCircle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export default function SkinConcernStep() {
  const { userProfile, updateUserProfile } = useSkinCare()

  const handleNext = () => {
    if (userProfile.skinConcern) {
      updateUserProfile({ currentStep: userProfile.currentStep + 1 })
    }
  }

  const skinConcerns: { value: SkinConcern; label: string; description: string }[] = [
    {
      value: "Pimples, blackheads, whiteheads, and clogged pores",
      label: "Acne & Breakouts",
      description: "Pimples, blackheads, whiteheads, and clogged pores",
    },
    {
      value: "Fine lines, wrinkles, loss of firmness and elasticity",
      label: "Signs of Aging",
      description: "Fine lines, wrinkles, loss of firmness and elasticity",
    },
    {
      value: "Lack of radiance, rough texture, uneven skin tone",
      label: "Dullness & Uneven Texture",
      description: "Lack of radiance, rough texture, uneven skin tone",
    },
    {
      value: "Sun spots, post-acne marks, melasma, uneven skin tone",
      label: "Dark Spots & Hyperpigmentation",
      description: "Sun spots, post-acne marks, melasma, uneven skin tone",
    },
    {
      value: "Irritation, redness, reactivity to products",
      label: "Redness & Sensitivity",
      description: "Irritation, redness, reactivity to products",
    },
  ]

  return (
    <div className="space-y-6">
      <RadioGroup
        value={userProfile.skinConcern}
        onValueChange={(value) => updateUserProfile({ skinConcern: value as SkinConcern })}
        className="space-y-3"
      >
        {skinConcerns.map((concern) => (
          <div
            key={concern.value}
            className={`flex items-start space-x-2 rounded-md border p-4 transition-all ${
              userProfile.skinConcern === concern.value
                ? "border-emerald-600 bg-emerald-50"
                : "hover:border-emerald-200"
            }`}
          >
            <RadioGroupItem value={concern.value} id={concern.value} className="mt-1" />
            <div className="flex-1 space-y-1">
              <div className="flex items-center">
                <Label
                  htmlFor={concern.value}
                  className="text-base font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {concern.label}
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-1 h-5 w-5 rounded-full p-0 text-muted-foreground"
                      >
                        <HelpCircle className="h-3 w-3" />
                        <span className="sr-only">Info</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" className="max-w-xs">
                      <p>{concern.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-sm text-muted-foreground">{concern.description}</p>
            </div>
          </div>
        ))}
      </RadioGroup>

      <div className="flex justify-between pt-4">
        <Button
          variant="outline"
          onClick={() => updateUserProfile({ currentStep: Math.max(0, userProfile.currentStep - 1) })}
        >
          Back
        </Button>
        <Button
          onClick={handleNext}
          disabled={!userProfile.skinConcern}
          className="bg-[#211D39] text-amber-50"
        >
          Next
        </Button>
      </div>
    </div>
  )
}
