"use client"
import { useSkinCare } from "@/context/skin-care-context"
import { Button } from "@/components/ui/button"
import { Check, Loader2, AlertCircle, RefreshCw } from "lucide-react"
import Image from "next/image"
import { useCallback, useState } from "react"
import React from "react"

interface SummaryStepProps {
  onComplete: () => void
}

interface SkincareRoutineRequest {
  skinType: string;
  skinConcern: string;
  commitmentLevel: string;
  preferredProducts: string;
  limit?: number;
  categories?: string[];
  priceRange?: {
    min: number;
    max: number;
  };
}

interface SkincareRoutineResponse {
  success: boolean;
  data?: any;
  error?: string;
  details?: string[];
  metadata?: {
    totalProducts: number;
    analyzedProducts: number;
    processingTime: number;
    cached: boolean;
  };
  processingTime?: number;
}

export default function SummaryStep({ onComplete }: SummaryStepProps) {
  const { userProfile, updateUserProfile } = useSkinCare();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [processingTime, setProcessingTime] = useState<number | null>(null);

  // Map user profile values to API expected values
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
        return "Acne";
      case "Fine lines, wrinkles, loss of firmness and elasticity":
        return "Anti-aging";
      case "Lack of radiance, rough texture, uneven skin tone":
        return "Brightening";
      case "Sun spots, post-acne marks, melasma, uneven skin tone":
        return "Brightening";
      case "Irritation, redness, reactivity to products":
        return "Hydration";
      default:
        return "Hydration";
    }
  };

  const mapRoutineTypeToAPI = (routineType: string): string => {
    switch (routineType) {
      case "A simple, no-fuss routine with just the essentials 3-4 steps":
        return "Minimal";
      case "A balanced routine with targeted treatments 5-6 steps":
        return "Moderate";
      case "A complete routine for maximum results 7+ steps":
        return "Extensive";
      default:
        return "Moderate";
    }
  };

  // Determine preferred products based on routine type and concern
  const determinePreferredProducts = (routineType: string, skinConcern: string): string => {
    if (routineType === "A complete routine for maximum results 7+ steps") {
      return "Premium";
    } else if (routineType === "A simple, no-fuss routine with just the essentials 3-4 steps") {
      return "Budget-friendly";
    } else if (skinConcern.includes("Irritation") || skinConcern.includes("Sensitive")) {
      return "Dermatologist Recommended";
    }
    return "Natural/Organic";
  };

  // Get relevant product categories based on skin concern
  const getRelevantCategories = (skinConcern: string): string[] => {
    const baseCategories = ["cleansers", "moisturizers", "sunscreens"];
    
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

  // Generate skincare routine with retry logic
  const generateSkincareRoutine = useCallback(async (retryAttempt: number = 0): Promise<SkincareRoutineResponse> => {
    const maxRetries = 3;
    const timeout = 15000; // 15 seconds timeout
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const requestPayload: SkincareRoutineRequest = {
        skinType: mapSkinTypeToAPI(userProfile.skinType),
        skinConcern: mapSkinConcernToAPI(userProfile.skinConcern),
        commitmentLevel: mapRoutineTypeToAPI(userProfile.routineType),
        preferredProducts: determinePreferredProducts(userProfile.routineType, userProfile.skinConcern),
        limit: 150, // Reasonable limit for good selection
        categories: getRelevantCategories(userProfile.skinConcern),
        priceRange: {
          min: 5,
          max: userProfile.routineType === "A complete routine for maximum results 7+ steps" ? 150 : 80
        }
      };

      console.log(`🚀 Generating skincare routine (attempt ${retryAttempt + 1}/${maxRetries + 1}):`, {
        skinType: requestPayload.skinType,
        concern: requestPayload.skinConcern,
        commitment: requestPayload.commitmentLevel,
        preferred: requestPayload.preferredProducts,
        categories: requestPayload.categories?.slice(0, 3) // Log first 3 categories
      });

      const startTime = Date.now();
      
      const response = await fetch('/api/getmyroutine', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;
      setProcessingTime(responseTime);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: SkincareRoutineResponse = await response.json();
      
      if (data.success) {
        console.log('✅ Routine generated successfully:', {
          processingTime: data.metadata?.processingTime || responseTime,
          productsAnalyzed: data.metadata?.analyzedProducts,
          cached: data.metadata?.cached,
          totalTime: responseTime
        });
        
        // Store routine in user profile context
        updateUserProfile({ 
          generatedRoutine: data.data,
        });
        
        return data;
      } else {
        throw new Error(data.error || 'Failed to generate routine');
      }

    } catch (error: any) {
      clearTimeout(timeoutId);
      
      console.error(`❌ Routine generation failed (attempt ${retryAttempt + 1}):`, error.message);
      
      // Handle specific error types
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - the server took too long to respond');
      }
      
      if (error.message?.includes('fetch')) {
        throw new Error('Network error - please check your connection');
      }
      
      // Retry logic for certain errors
      if (retryAttempt < maxRetries && 
          (error.message?.includes('timeout') || 
           error.message?.includes('500') || 
           error.message?.includes('503'))) {
        
        const delay = Math.min(1000 * Math.pow(2, retryAttempt), 5000); // Exponential backoff
        console.log(`🔄 Retrying in ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return generateSkincareRoutine(retryAttempt + 1);
      }
      
      throw error;
    }
  }, [userProfile, updateUserProfile]);

  const handleGenerateRoutine = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    setRetryCount(0);
    setProcessingTime(null);

    try {
      await generateSkincareRoutine();
      onComplete(); // Navigate to results page
    } catch (err: any) {
      setError(err.message || 'Failed to generate skincare routine');
      console.error('❌ Final error:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [generateSkincareRoutine, onComplete]);

  const handleRetry = useCallback(() => {
    setRetryCount(prev => prev + 1);
    handleGenerateRoutine();
  }, [handleGenerateRoutine]);

  // Display labels (keep existing functions)
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
          onClick={handleGenerateRoutine}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            "Get My Routine"
          )}
        </Button>
      </div>

      {/* Debug Info (remove in production) */}
      {process.env.NODE_ENV === 'development' && processingTime && (
        <div className="text-xs text-gray-500 mt-2">
          API Response Time: {(processingTime / 1000).toFixed(2)}s
          {retryCount > 0 && ` | Retries: ${retryCount}`}
        </div>
      )}
    </div>
  )
}