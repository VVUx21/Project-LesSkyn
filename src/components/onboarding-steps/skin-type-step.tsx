"use client"

import { useSkinCare, type SkinType } from "@/context/skin-care-context"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { HelpCircle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export default function SkinTypeStep() {
  const { userProfile, updateUserProfile } = useSkinCare()

  const handleNext = () => {
    if (userProfile.skinType) {
      updateUserProfile({ currentStep: userProfile.currentStep + 1 })
    }
  }

  const skinTypes: { value: SkinType; label: string; description: string }[] = [
    {
      value: "Feels tight, may have flaky patches, rarely gets oily",
      label: "Dry",
      description: "Feels tight, may have flaky patches, rarely gets oily",
    },
    {
      value: "Shiny appearance, enlarged pores, prone to breakouts",
      label: "Oily",
      description: "Shiny appearance, enlarged pores, prone to breakouts",
    },
    {
      value: "Oily T-zone (forehead, nose, chin) but dry cheeks",
      label: "Combination",
      description: "Oily T-zone (forehead, nose, chin) but dry cheeks",
    },
    {
      value: "Well-balanced, not too oily or dry, few imperfections",
      label: "Normal",
      description: "Well-balanced, not too oily or dry, few imperfections",
    },
    {
      value: "Easily irritated, may react to products with redness",
      label: "Sensitive",
      description: "Easily irritated, may react to products with redness",
    },
  ]

  return (
    <div className="space-y-6">
      <RadioGroup
        value={userProfile.skinType}
        onValueChange={(value) => updateUserProfile({ skinType: value as SkinType })}
        className="space-y-3"
      >
        {skinTypes.map((type) => (
          <div
            key={type.value}
            className={`flex items-start space-x-2 rounded-md border p-4 transition-all ${
              userProfile.skinType === type.value ? "border-emerald-600 bg-emerald-50" : "hover:border-emerald-200"
            }`}
          >
            <RadioGroupItem value={type.value} id={type.value} className="mt-1" />
            <div className="flex-1 space-y-1">
              <div className="flex items-center">
                <Label
                  htmlFor={type.value}
                  className="text-base font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {type.label}
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
                      <p>{type.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-sm text-muted-foreground">{type.description}</p>
            </div>
          </div>
        ))}
      </RadioGroup>

      <div className="flex justify-between pt-4">
        <Button
          variant="outline"
          onClick={() => updateUserProfile({ currentStep: Math.max(0, userProfile.currentStep - 1) })}
          disabled={userProfile.currentStep === 0}
        >
          Back
        </Button>
        <Button onClick={handleNext} disabled={!userProfile.skinType} className="bg-[#211D39] text-amber-50">
          Next
        </Button>
      </div>
    </div>
  )
}
