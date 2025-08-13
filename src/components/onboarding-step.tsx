import type React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface OnboardingStepProps {
  title: string
  description: string
  children: React.ReactNode
  currentStep: number
  totalSteps: number
}

export default function OnboardingStep({ title, description, children, currentStep, totalSteps }: OnboardingStepProps) {
  return (
    <Card className="w-1/2 mx-auto my-8 p-6 shadow-lg bg-[#F3E9FF26] dark:bg-gray-800">
      <CardHeader>
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
