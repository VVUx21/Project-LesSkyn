"use client"

import { useSkinCare, type RoutineType } from "@/context/skin-care-context"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"

export default function RoutineTypeStep() {
  const { userProfile, updateUserProfile } = useSkinCare()

  const handleNext = () => {
    if (userProfile.routineType) {
      updateUserProfile({ currentStep: userProfile.currentStep + 1 })
    }
  }

  const routineTypes: { value: RoutineType; label: string; description: string; steps: string }[] = [
    {
      value: "A simple, no-fuss routine with just the essentials 3-4 steps",
      label: "Minimal",
      description: "A simple, no-fuss routine with just the essentials.",
      steps: "3-4 steps",
    },
    {
      value: "A balanced routine with targeted treatments 5-6 steps",
      label: "Standard",
      description: "A balanced routine with targeted treatments.",
      steps: "5-6 steps",
    },
    {
      value: "A complete routine for maximum results 7+ steps",
      label: "Comprehensive",
      description: "A complete routine for maximum results.",
      steps: "7+ steps",
    },
  ]

  return (
    <div className="space-y-6">
      <RadioGroup
        value={userProfile.routineType}
        onValueChange={(value) => updateUserProfile({ routineType: value as RoutineType })}
        className="space-y-3"
      >
        {routineTypes.map((type) => (
          <div
            key={type.value}
            className={`flex items-start space-x-2 rounded-md border p-4 transition-all ${
              userProfile.routineType === type.value ? "border-emerald-600 bg-emerald-50" : "hover:border-emerald-200"
            }`}
          >
            <RadioGroupItem value={type.value} id={type.value} className="mt-1" />
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor={type.value}
                  className="text-base font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {type.label}
                </Label>
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800">
                  {type.steps}
                </span>
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
        >
          Back
        </Button>
        <Button
          onClick={handleNext}
          disabled={!userProfile.routineType}
          className="bg-[#211D39] text-amber-50"
        >
          Next
        </Button>
      </div>
    </div>
  )
}
