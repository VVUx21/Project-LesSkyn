import type React from "react"
import Image from "next/image"
import Navbar from "@/components/Navbar"
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-full flex-col bg-gradient-to-br from-[#BD81D9] to-[#776CDC] overflow-x-hidden">
      <main className="flex-1 relative">
        {/* Decorative background shape */}
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10" />
        <div className="flex items-center justify-center p-4">
          <Navbar/>
        </div>
        {/* Wrap children with UserProvider to provide user context */}
        <div className="container max-w-screen py-8">
            {children}
        </div>
        <Image
        src="https://res.cloudinary.com/dgtdkqfsx/image/upload/v1755124069/image_26_ruzboq.png"
        alt="Onboarding Background"
        className="absolute bottom-0 left-0 z-0"
        width={400}
        height={400}
        />
      </main>
    </div>
  )
}
