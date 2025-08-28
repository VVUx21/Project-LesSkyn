"use client"
import { useSkinCare } from "@/context/skin-care-context"
import { Button } from "@/components/ui/button"
import { Check, Loader2, AlertCircle, RefreshCw } from "lucide-react"
import { SkincareRoutineRequest,SkincareRoutineResponse } from "@/lib/types"
import { MultiStepLoader } from '@/components/ui/multi-step-loader';
import Image from "next/image"
import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import React from "react"

interface SummaryStepProps {
  onComplete: () => void
}

const loadingStates = [
  { text: "Searching for your personalized routine..." },
  { text: "AI is still crafting your perfect skincare plan..." },
  { text: "Analyzing thousands of product combinations..." },
  { text: "Fine-tuning morning and evening routines..." },
  { text: "Adding finishing touches to your regimen..." },
  { text: "Almost ready - finalizing recommendations..." },
  { text: "Your routine is being saved securely..." },
  { text: "Just a few more seconds - perfecting details..." }
];

export default function SummaryStep({ onComplete }: SummaryStepProps) {
  const router = useRouter();
  const { userProfile, updateUserProfile } = useSkinCare();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [processingTime, setProcessingTime] = useState<number | null>(null);

  const mapSkinTypeToAPI = (skinType: string): string => {
    switch (skinType) {
      case "Oily T-zone (forehead, nose, chin) but dry cheeks":
        return "Combination";
      case "Shiny appearance, enlarged pores, prone to breakouts":
        return "Oily";
      case "Well-balanced, not too oily or dry, few imperfections":
        return "Normal";
      case "Feels tight, may have flaky patches, rarely gets oily":
        return "Dry";
      case "Easily irritated, may react to products with redness":
        return "Sensitive";
      default:
        return "Normal";
    }
  };

  const mapSkinConcernToAPI = (skinConcern: string): string => {
    switch (skinConcern) {
      case "Pimples, blackheads, whiteheads, and clogged pores":
        return "Clear Acne & Breakouts";
      case "Fine lines, wrinkles, loss of firmness and elasticity":
        return "Anti-aging";
      case "Lack of radiance, rough texture, uneven skin tone":
        return "Achieve a Natural Glow";
      case "Sun spots, post-acne marks, melasma, uneven skin tone":
        return "Even Out Skin Tone & Reduce Dark Spots";
      case "Irritation, redness, reactivity to products":
        return "Reduce Redness & Sensitivity";
      default:
        return "Not specified";
    }
  };

  const mapRoutineTypeToAPI = (routineType: string): string => {
    switch (routineType) {
      case "A simple, no-fuss routine with just the essentials 3-4 steps":
        return "Minimal";
      case "A balanced routine with targeted treatments 5-6 steps":
        return "Standard";
      case "A complete routine for maximum results 7+ steps":
        return "Comprehensive";
      default:
        return "Standard";
    }
  };

  const determinePreferredProducts = (routineType:string) => {
  if (routineType === "A simple, no-fuss routine with just the essentials 3-4 steps") {
    return "Natural/Organic Products";
  } 
  else if (routineType === "A complete routine for maximum results 7+ steps") {
    return "Budget-Friendly + Natural/Organic Products";
  } 
  else {
    return "Natural/Organic Products";
  }
};

  // Get relevant product categories based on skin concern
  const getRelevantCategories = (skinConcern: string): string[] => {
    const baseCategories = ["cleansers", "moisturizers", "serum","facewash"];
    
    switch (skinConcern) {
      case "Pimples, blackheads, whiteheads, and clogged pores":
        return [...baseCategories, "acne treatments", "serums", "toners"];
      case "Fine lines, wrinkles, loss of firmness and elasticity":
        return [...baseCategories, "anti-aging", "serums", "retinoids", "peptides"];
      case "Lack of radiance, rough texture, uneven skin tone":
        return [...baseCategories, "exfoliants", "serums", "vitamin c", "brightening"];
      case "Sun spots, post-acne marks, melasma, uneven skin tone":
        return [...baseCategories, "brightening", "vitamin c", "niacinamide", "serums"];
      case "Irritation, redness, reactivity to products":
        return [...baseCategories, "sensitive skin", "gentle", "hydrating serums"];
      default:
        return baseCategories;
    }
  };

  const generateSkincareRoutine = useCallback(async (useStreaming: boolean = true): Promise<SkincareRoutineResponse> => {
  const timeout = 120000; 

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const requestPayload: SkincareRoutineRequest = {
      skinType: mapSkinTypeToAPI(userProfile.skinType),
      skinConcern: mapSkinConcernToAPI(userProfile.skinConcern),
      commitmentLevel: mapRoutineTypeToAPI(userProfile.routineType),
      preferredProducts: determinePreferredProducts(userProfile.routineType),
      limit: 150,
      categories: getRelevantCategories(userProfile.skinConcern),
      priceRange: {
        min: 5,
        max: userProfile.routineType === "A complete routine for maximum results 7+ steps" ? 150 : 80
      }
    };

    console.log('🚀 Generating skincare routine:', {
      skinType: requestPayload.skinType,
      concern: requestPayload.skinConcern,
      commitment: requestPayload.commitmentLevel,
      streaming: useStreaming
    });

    const startTime = Date.now();
    
    if (useStreaming) {
      return await handleStreamingResponse(requestPayload, controller, startTime, timeoutId);
    } else {
      return await handleRegularResponse(requestPayload, controller, startTime, timeoutId);
    }

  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error('❌ Routine generation failed:', error.message);
    
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - please try again');
    }
    
    if (error.message?.includes('fetch')) {
      throw new Error('Network error - please check your connection');
    }
    
    throw error;
  }
}, [userProfile, updateUserProfile]);

const handleStreamingResponse = async (
  requestPayload: SkincareRoutineRequest,
  controller: AbortController,
  startTime: number,
  timeoutId: NodeJS.Timeout
): Promise<SkincareRoutineResponse> => {
  const response = await fetch('/api/getmyroutine?stream=true', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestPayload),
    signal: controller.signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let finalResult: any = null;

  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'metadata') {
                console.log('📊 Metadata:', data.data);
              } else if (data.type === 'complete') {
                console.log('✅ Routine completed');
                finalResult = data.data;
                clearTimeout(timeoutId);
                break;
              } else if (data.type === 'error') {
                throw new Error(data.error || 'Stream processing failed');
              }
            } catch (parseError) {
              console.warn('Failed to parse streaming data:', line);
            }
          }
        }

        if (finalResult) break;
      }
    } finally {
      reader.releaseLock();
    }
  }

  if (!finalResult) {
    throw new Error('No complete routine received from stream');
  }

  const responseTime = Date.now() - startTime;
  setProcessingTime(responseTime);

  updateUserProfile({ generatedRoutine: finalResult });

  return {
    success: true,
    data: finalResult,
    metadata: { 
      processingTime: responseTime,
      totalProducts: 0,
      analyzedProducts: 0,
      cached: false
    }
  };
};

const handleRegularResponse = async (
  requestPayload: SkincareRoutineRequest,
  controller: AbortController,
  startTime: number,
  timeoutId: NodeJS.Timeout
): Promise<SkincareRoutineResponse> => {
  const response = await fetch('/api/getmyroutine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestPayload),
    signal: controller.signal,
  });

  clearTimeout(timeoutId);
  const responseTime = Date.now() - startTime;
  setProcessingTime(responseTime);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  const data: SkincareRoutineResponse = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Failed to generate routine');
  }

  console.log('✅ Routine generated:', {
    processingTime: data.metadata?.processingTime || responseTime,
    productsAnalyzed: data.metadata?.analyzedProducts
  });

  updateUserProfile({ generatedRoutine: data.data });
  return data;
};

const handleGenerateRoutine = useCallback(async (useStreaming: boolean = true) => {
  setIsGenerating(true);
  setError(null);
  setProcessingTime(null);

  const apiSkinType = mapSkinTypeToAPI(userProfile.skinType);
  const apiSkinConcern = mapSkinConcernToAPI(userProfile.skinConcern);
  const apiCommitment = mapRoutineTypeToAPI(userProfile.routineType);

  const queryParams = new URLSearchParams({
    skinType: apiSkinType,
    skinConcern: apiSkinConcern,
  });

  // 2) Default path: use the existing generation flow
  try {
    const routine = await generateSkincareRoutine(useStreaming);

    if (routine?.success) {
      setIsGenerating(false);
      router.push(`/skincare_routine?${queryParams.toString()}`);
    } else {
      throw new Error("Routine generation failed");
    }
  } catch (err: any) {
    setError(err?.message || "Failed to generate skincare routine");
    console.error("❌ Final error:", err);
    setIsGenerating(false);
  }
}, [userProfile, router, generateSkincareRoutine]);

const handleRetry = useCallback(() => {
  handleGenerateRoutine(false); // Use regular mode for retry
}, [handleGenerateRoutine]);

  const getSkinTypeLabel = () => {
    switch (userProfile.skinType) {
      case "Oily T-zone (forehead, nose, chin) but dry cheeks":
        return "Combination"
      case "Shiny appearance, enlarged pores, prone to breakouts":
        return "Oily"
      case "Well-balanced, not too oily or dry, few imperfections":
        return "Normal"
      case "Feels tight, may have flaky patches, rarely gets oily":
        return "Dry"
      case "Easily irritated, may react to products with redness":
        return "Sensitive"
      default:
        return "Not specified"
    }
  }

  const getSkinConcernLabel = () => {
  switch (userProfile.skinConcern) {
    case "Pimples, blackheads, whiteheads, and clogged pores":
      return "Clear Acne & Breakouts";
    case "Fine lines, wrinkles, loss of firmness and elasticity":
      return "Anti-aging";
    case "Lack of radiance, rough texture, uneven skin tone":
      return "Achieve a Natural Glow";
    case "Sun spots, post-acne marks, melasma, uneven skin tone":
      return "Even Out Skin Tone & Reduce Dark Spots";
    case "Irritation, redness, reactivity to products":
      return "Reduce Redness & Sensitivity";
    default:
      return "Not specified";
  }
};

  const getRoutineTypeLabel = () => {
    switch (userProfile.routineType) {
      case "A simple, no-fuss routine with just the essentials 3-4 steps":
        return "Minimal"
      case "A balanced routine with targeted treatments 5-6 steps":
        return "Standard"
      case "A complete routine for maximum results 7+ steps":
        return "Comprehensive"
      default:
        return "Not specified"
    }
  }

  return (
    <div className="space-y-6">
      {isGenerating && (
        <MultiStepLoader
          loadingStates={loadingStates}
          loading={true}
          duration={2000}
          loop={false}
        />
      )}
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

      {/* Success Message */}
      {!error && !isGenerating && (
        <div className="rounded-lg bg-emerald-50 p-4 text-emerald-800">
          <div className="flex items-start gap-3">
            <Check className="mt-0.5 h-5 w-5 text-emerald-600" />
            <div>
              <p className="font-medium">You&apos;re all set!</p>
              <p className="text-sm">
                Based on your profile, we&apos;ll create a personalized skincare routine and product recommendations just for you.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isGenerating && (
        <div className="rounded-lg bg-blue-50 p-4 text-blue-800">
          <div className="flex items-start gap-3">
            <Loader2 className="mt-0.5 h-5 w-5 animate-spin text-blue-600" />
            <div>
              <p className="font-medium">Generating your routine...</p>
              <p className="text-sm">
                Our AI is analyzing thousands of products to find the perfect match for your skin. This may take up to 10 seconds.
              </p>
              {processingTime && (
                <p className="text-xs mt-1 text-blue-600">
                  Processing time: {(processingTime / 1000).toFixed(1)}s
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !isGenerating && (
        <div className="rounded-lg bg-red-50 p-4 text-red-800">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-red-600" />
            <div className="flex-1">
              <p className="font-medium">Generation Failed</p>
              <p className="text-sm mb-3">{error}</p>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleRetry}
                className="border-red-200 text-red-700 hover:bg-red-100"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Try Again {retryCount > 0 && `(${retryCount})`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between pt-4">
        <Button
          variant="outline"
          onClick={() => updateUserProfile({ currentStep: Math.max(0, userProfile.currentStep - 1) })}
          disabled={isGenerating}
        >
          Back
        </Button>
        <Button 
          className="bg-[#211D39] text-amber-50 min-w-[140px]"
          onClick={() => handleGenerateRoutine(true)}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              <span className="text-sm">
                {processingTime ? `${Math.floor(processingTime/1000)}s` : 'Generating...'}
              </span>
            </>
          ) : (
            "Get My Routine"
          )}
        </Button>
      </div>
    </div>
  )
}