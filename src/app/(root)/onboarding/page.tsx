"use client"
import { useEffect} from "react"
import { useRouter } from "next/navigation"
import { useSkinCare } from "@/context/skin-care-context"
import OnboardingStep from "@/components/onboarding-step"
import SkinTypeStep from "@/components/onboarding-steps/skin-type-step"
import SkinConcernStep from "@/components/onboarding-steps/skin-concern-step"
import RoutineTypeStep from "@/components/onboarding-steps/routine-type-step"
import FaceScanStep from "@/components/onboarding-steps/face-scan-step"
import SummaryStep from "@/components/onboarding-steps/summary-step"
//import { useUserContext } from "@/context/userstate"
import React from "react"

export default function OnboardingPage(onComplete: () => void) {
  const { userProfile, updateUserProfile } = useSkinCare()
  const router = useRouter()
//   const UserContext= useUserContext();
//   const Context = React.useContext(UserContext);
//   const User = Context?.User;
//   const quizAttempts = Context?.quizAttempts ?? 0;
//   useEffect(() => {
//   if (User === null) return;

//   if (userProfile.completedOnboarding) {
//     updateUserProfile({ currentStep: 0, completedOnboarding: false });
//   }

//   const handleStartQuizClick = () => {
//     if (!User) {
//       if (quizAttempts > 2) {
//         alert("Please sign in or sign up to continue with the quiz.");
//         router.push("/sign-in");
//         return;
//       }
//       router.push("/onboarding");
//     }
//   };

//   handleStartQuizClick();
// }, [User]);

  const handleComplete = () => {
    updateUserProfile({ completedOnboarding: true })
    router.push("/dashboard")
  }

  const steps = [
    {
      title: "What's your skin type?",
      description: "This helps us understand your skin's natural characteristics.",
      component: <SkinTypeStep />,
    },
    {
      title: "What's your main skin concern?",
      description: "We'll focus on products that address this specific issue.",
      component: <SkinConcernStep />,
    },
    {
      title: "What type of routine do you prefer?",
      description: "We'll tailor the complexity of your routine based on your preference.",
      component: <RoutineTypeStep />,
    },
    {
      title: "Upload a face scan (optional)",
      description: "This helps us better understand your skin condition.",
      component: <FaceScanStep />,
    },
    {
      title: "Summary",
      description: "Review your selections before we create your personalized routine.",
      component: <SummaryStep onComplete={handleComplete} />,
    },
  ]

  const currentStep = steps[userProfile.currentStep]
  return (
    <div className="flex flex-col items-center w-full min-h-screen p-4">
      {/* Progress Bar */}
      <div className="my-8 w-1/2 px-4">
        <div className="mb-2 flex justify-between text-sm text-[#211D39]">
          <span>
            Step {userProfile.currentStep + 1} of {steps.length}
          </span>
          <span>{Math.round(((userProfile.currentStep + 1) / steps.length) * 100)}% complete</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-[#211D39] transition-all duration-300"
            style={{ width: `${((userProfile.currentStep + 1) / steps.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Onboarding Step Component */}
      <OnboardingStep
        title={currentStep.title}
        description={currentStep.description}
        currentStep={userProfile.currentStep}
        totalSteps={steps.length}
      >
        {currentStep.component}
      </OnboardingStep>
    </div>
  )
}
