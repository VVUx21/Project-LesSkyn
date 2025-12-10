"use client"
import { useSkinCare } from "@/context/skin-care-context"
import { Button } from "@/components/ui/button"
import { Check, Loader2, AlertCircle, RefreshCw } from "lucide-react"
import { SkincareRoutineResponse } from "@/lib/types"
import { MultiStepLoader } from '@/components/ui/multi-step-loader';
import Image from "next/image"
import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"

interface SummaryStepProps {
  onComplete: () => void
}

const loadingStates = [
  { text: "Searching for your personalized routine..." },
  { text: "AI is crafting your perfect skincare plan..." },
  { text: "Analyzing product combinations..." },
  { text: "Fine-tuning morning and evening routines..." },
  { text: "Almost ready - finalizing recommendations..." },
];

export default function SummaryStep({ onComplete }: SummaryStepProps) {
  const router = useRouter();
  const { userProfile, updateUserProfile } = useSkinCare();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [processingTime, setProcessingTime] = useState<number | null>(null);

  // Map user-friendly skin type to API format
  const mapSkinTypeToAPI = (skinType: string): string => {
    const mapping: Record<string, string> = {
      "Oily T-zone (forehead, nose, chin) but dry cheeks": "Combination",
      "Shiny appearance, enlarged pores, prone to breakouts": "Oily",
      "Well-balanced, not too oily or dry, few imperfections": "Normal",
      "Feels tight, may have flaky patches, rarely gets oily": "Dry",
      "Easily irritated, may react to products with redness": "Sensitive"
    };
    return mapping[skinType] || "Normal";
  };

  // Map user-friendly skin concern to API format
  const mapSkinConcernToAPI = (skinConcern: string): string => {
    const mapping: Record<string, string> = {
      "Pimples, blackheads, whiteheads, and clogged pores": "Clear Acne & Breakouts",
      "Fine lines, wrinkles, loss of firmness and elasticity": "Anti-aging",
      "Lack of radiance, rough texture, uneven skin tone": "Achieve a Natural Glow",
      "Sun spots, post-acne marks, melasma, uneven skin tone": "Even Out Skin Tone & Reduce Dark Spots",
      "Irritation, redness, reactivity to products": "Reduce Redness & Sensitivity"
    };
    return mapping[skinConcern] || "Not specified";
  };

  // Map routine type to API format
  const mapRoutineTypeToAPI = (routineType: string): string => {
    const mapping: Record<string, string> = {
      "A simple, no-fuss routine with just the essentials 3-4 steps": "Minimal",
      "A balanced routine with targeted treatments 5-6 steps": "Standard",
      "A complete routine for maximum results 7+ steps": "Comprehensive"
    };
    return mapping[routineType] || "Standard";
  };

  // Determine preferred products based on routine type
  const determinePreferredProducts = (routineType: string): string => {
    if (routineType === "A complete routine for maximum results 7+ steps") {
      return "Budget-Friendly + Natural/Organic Products";
    }
    return "Natural/Organic Products";
  };

  // Get relevant product categories based on skin concern
  const getRelevantCategories = (skinConcern: string): string[] => {
    const baseCategories = ["cleansers", "moisturizers", "serum", "facewash"];
    const concernCategories: Record<string, string[]> = {
      "Pimples, blackheads, whiteheads, and clogged pores": ["acne treatments", "serums", "toners"],
      "Fine lines, wrinkles, loss of firmness and elasticity": ["anti-aging", "serums", "retinoids", "peptides"],
      "Lack of radiance, rough texture, uneven skin tone": ["exfoliants", "serums", "vitamin c", "brightening"],
      "Sun spots, post-acne marks, melasma, uneven skin tone": ["brightening", "vitamin c", "niacinamide", "serums"],
      "Irritation, redness, reactivity to products": ["sensitive skin", "gentle", "hydrating serums"]
    };
    return [...baseCategories, ...(concernCategories[skinConcern] || [])];
  };

  // Generate routine using realtime API with polling
  const generateRoutine = useCallback(async (): Promise<SkincareRoutineResponse> => {
    const sessionId = `routine_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    
    const requestPayload = {
      sessionId,
      skinType: mapSkinTypeToAPI(userProfile.skinType),
      skinConcern: mapSkinConcernToAPI(userProfile.skinConcern),
      commitmentLevel: mapRoutineTypeToAPI(userProfile.routineType),
      preferredProducts: determinePreferredProducts(userProfile.routineType),
      limit: 20, // Reduced from 150 to stay within gpt-4o-mini token limits
      categories: getRelevantCategories(userProfile.skinConcern),
      priceRange: {
        min: 5,
        max: userProfile.routineType === "A complete routine for maximum results 7+ steps" ? 150 : 80
      }
    };

    console.log('🚀 Starting routine generation:', requestPayload);

    // Start the realtime generation
    const startResponse = await fetch('/api/getmyroutine/realtime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload)
    });

    const startResult = await startResponse.json();
    if (!startResult.success) {
      throw new Error(startResult.error || 'Failed to start generation');
    }

    // Poll for completion
    const startTime = Date.now();
    const timeout = 120000; // 2 minutes

    while (Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const channelResponse = await fetch(`/api/getmyroutine/channel/${sessionId}`);
      const channelResult = await channelResponse.json();

      if (!channelResult.success) continue;

      for (const msg of channelResult.messages || []) {
        if (msg.event === 'ai.complete') {
          setProcessingTime(Date.now() - startTime);
          return {
            success: true,
            data: msg.data.routine,
            metadata: {
              processingTime: msg.data.processingTime,
              totalProducts: 0,
              analyzedProducts: 0,
              cached: msg.data.cached
            }
          };
        } else if (msg.event === 'ai.error') {
          throw new Error(msg.data.error || 'Generation failed');
        }
      }
    }

    throw new Error('Generation timed out');
  }, [userProfile]);

  // Handle generate button click
  const handleGenerateRoutine = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    setProcessingTime(null);

    const queryParams = new URLSearchParams({
      skinType: mapSkinTypeToAPI(userProfile.skinType),
      skinConcern: mapSkinConcernToAPI(userProfile.skinConcern),
    });

    try {
      const routine = await generateRoutine();
      if (routine?.success) {
        setIsGenerating(false);
        router.push(`/skincare_routine?${queryParams.toString()}`);
      } else {
        throw new Error("Routine generation failed");
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to generate skincare routine";
      setError(errorMessage);
      setRetryCount(prev => prev + 1);
      console.error("❌ Generation error:", err);
      setIsGenerating(false);
    }
  }, [userProfile, router, generateRoutine]);

  // Get display labels
  const getSkinTypeLabel = (): string => {
    const labels: Record<string, string> = {
      "Oily T-zone (forehead, nose, chin) but dry cheeks": "Combination",
      "Shiny appearance, enlarged pores, prone to breakouts": "Oily",
      "Well-balanced, not too oily or dry, few imperfections": "Normal",
      "Feels tight, may have flaky patches, rarely gets oily": "Dry",
      "Easily irritated, may react to products with redness": "Sensitive"
    };
    return labels[userProfile.skinType] || "Not specified";
  };

  const getSkinConcernLabel = (): string => {
    const labels: Record<string, string> = {
      "Pimples, blackheads, whiteheads, and clogged pores": "Clear Acne & Breakouts",
      "Fine lines, wrinkles, loss of firmness and elasticity": "Anti-aging",
      "Lack of radiance, rough texture, uneven skin tone": "Achieve a Natural Glow",
      "Sun spots, post-acne marks, melasma, uneven skin tone": "Even Out Skin Tone & Reduce Dark Spots",
      "Irritation, redness, reactivity to products": "Reduce Redness & Sensitivity"
    };
    return labels[userProfile.skinConcern] || "Not specified";
  };

  const getRoutineTypeLabel = (): string => {
    const labels: Record<string, string> = {
      "A simple, no-fuss routine with just the essentials 3-4 steps": "Minimal",
      "A balanced routine with targeted treatments 5-6 steps": "Standard",
      "A complete routine for maximum results 7+ steps": "Comprehensive"
    };
    return labels[userProfile.routineType] || "Not specified";
  };

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
      
      {/* Skin Profile Summary */}
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
              src={userProfile.faceScanImage}
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
                Our AI is analyzing products to find the perfect match for your skin.
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
                onClick={handleGenerateRoutine}
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
          onClick={handleGenerateRoutine}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              <span className="text-sm">Generating...</span>
            </>
          ) : (
            "Get My Routine"
          )}
        </Button>
      </div>
    </div>
  )
}
