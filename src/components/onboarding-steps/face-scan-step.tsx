"use client"

import type React from "react"

import { useState } from "react"
import { useSkinCare } from "@/context/skin-care-context"
import { Button } from "@/components/ui/button"
import { Upload, X } from "lucide-react"
import Image from "next/image"

export default function FaceScanStep() {
  const { userProfile, updateUserProfile } = useSkinCare()
  const [previewUrl, setPreviewUrl] = useState<string | null>(userProfile.faceScanImage || null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)

      // In a real app, you'd upload the file to a server
      // For now, we'll just store the object URL
      updateUserProfile({ faceScanImage: url })
    }
  }

  const handleRemoveImage = () => {
    setPreviewUrl(null)
    updateUserProfile({ faceScanImage: undefined })
  }

  const handleNext = () => {
    updateUserProfile({ currentStep: userProfile.currentStep + 1 })
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-dashed p-6 text-center">
        {previewUrl ? (
          <div className="relative mx-auto max-w-xs">
            <Image
              src={previewUrl || "/placeholder.svg"}
              alt="Face scan preview"
              width={300}
              height={300}
              className="mx-auto rounded-lg object-cover"
            />
            <Button variant="destructive" size="icon" className="absolute right-2 top-2" onClick={handleRemoveImage}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <Upload className="h-10 w-10 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Drag and drop your face scan image here</p>
              <p className="text-xs text-muted-foreground">Or click to browse (PNG, JPG up to 5MB)</p>
            </div>
            <Button variant="outline" className="mt-2">
              <label className="cursor-pointer">
                Browse Files
                <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
              </label>
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-lg p-4 bg-[#F3E9FF26]">
        <p className="text-sm font-medium">This step is optional</p>
        <p className="text-xs text-[#211D39]">
          You can skip this step if you don't want to upload a face scan. Your recommendations will be based on your
          answers to the previous questions.
        </p>
      </div>

      <div className="flex justify-between pt-4">
        <Button
          variant="outline"
          onClick={() => updateUserProfile({ currentStep: Math.max(0, userProfile.currentStep - 1) })}
        >
          Back
        </Button>
        <Button onClick={handleNext} className="bg-[#211D39] text-amber-50">
          {previewUrl ? "Next" : "Skip & Continue"}
        </Button>
      </div>
    </div>
  )
}
