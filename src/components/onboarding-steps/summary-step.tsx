"use client"
import { useSkinCare } from "@/context/skin-care-context"
import { Button } from "@/components/ui/button"
import { Check, Loader2, AlertCircle, RefreshCw } from "lucide-react"
import { MultiStepLoader } from '@/components/ui/multi-step-loader';
import Image from "next/image"
import { useCallback, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  mapSkinTypeToAPI,
  mapSkinConcernToAPI,
  getSkinTypeLabel,
  getSkinConcernLabel,
  getRoutineTypeLabel,
  buildRoutineRequestPayload,
  LOADING_STATES
} from "@/lib/skincare-mappers"

interface SummaryStepProps {
  onComplete: () => void
}

export default function SummaryStep({ onComplete }: SummaryStepProps) {
  const router = useRouter();
  const { userProfile, updateUserProfile } = useSkinCare();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [streamStatus, setStreamStatus] = useState<string>('');
  const [streamProgress, setStreamProgress] = useState<number>(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Handle SSE events from server
  const handleSSEMessage = useCallback((event: MessageEvent, eventType: string) => {
    try {
      const data = JSON.parse(event.data);

      // Store last received event id so a full page refresh can resume.
      if (sessionIdRef.current && typeof event.lastEventId === 'string' && event.lastEventId.length > 0) {
        try {
          sessionStorage.setItem(`sse:lastEventId:${sessionIdRef.current}`, event.lastEventId);
        } catch {
          // ignore storage errors
        }
      }
      
      if (eventType === 'connected') {
        console.log('✅ SSE connected:', data.sessionId);
        setStreamStatus('Connected to server...');
        setStreamProgress(5);
      } else if (eventType === 'ai.status') {
        setStreamStatus(data.message || data.type);
        if (data.type === 'generating') {
          setStreamProgress(30);
        } else if (data.type === 'products_loaded') {
          setStreamProgress(20);
        } else if (data.type === 'started') {
          setStreamProgress(10);
        }
      } else if (eventType === 'ai.chunk') {
        const progress = Math.min(90, 30 + (data.chunksReceived || 0) * 2);
        setStreamProgress(progress);
      } else if (eventType === 'ai.complete') {
        setStreamProgress(100);
        setStreamStatus('Complete! Redirecting...');
        
        // Close SSE connection
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
        
        // Navigate to results page
        const queryParams = new URLSearchParams({
          skinType: mapSkinTypeToAPI(userProfile.skinType),
          skinConcern: mapSkinConcernToAPI(userProfile.skinConcern),
        });
        
        setTimeout(() => {
          setIsGenerating(false);
          router.push(`/skincare_routine?${queryParams.toString()}`);
        }, 500);
      } else if (eventType === 'ai.error') {
        setError(data.error || 'An error occurred');
        setIsGenerating(false);
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
      } else if (eventType === 'timeout') {
        setError('Generation timed out. Please try again.');
        setIsGenerating(false);
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
      }
    } catch (err) {
      console.error('Error parsing SSE message:', err);
    }
  }, [userProfile, router]);

  // Generate routine using SSE
  const generateRoutine = useCallback(async () => {
    const sessionId = `routine_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    sessionIdRef.current = sessionId;
    
    const requestPayload = buildRoutineRequestPayload(
      sessionId,
      userProfile.skinType,
      userProfile.skinConcern,
      userProfile.routineType,
      150 // limit
    );

    console.log('🚀 Starting routine generation with SSE:', requestPayload);

    try {
      // Start the generation on the backend
      const response = await fetch('/api/getmyroutine/realtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      });

      if (response.status === 401) {
        setError('Please sign in to generate your routine.');
        setIsGenerating(false);
        router.push('/Sign-in');
        return;
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to start generation');
      }

      console.log('✅ Generation started, opening SSE connection...');

      // Open SSE connection to receive real-time updates
      let cursorQuery = '';
      try {
        const lastId = sessionStorage.getItem(`sse:lastEventId:${sessionId}`);
        const parsed = lastId ? Number.parseInt(lastId, 10) : NaN;
        if (Number.isFinite(parsed) && parsed >= 0) {
          cursorQuery = `?cursor=${parsed + 1}`;
        }
      } catch {
        // ignore
      }

      const eventSource = new EventSource(`/api/getmyroutine/stream/${sessionId}${cursorQuery}`);
      eventSourceRef.current = eventSource;

      console.log('📡 SSE connection opened for session:', sessionId);

      // Listen for different event types
      eventSource.addEventListener('connected', (e) => handleSSEMessage(e, 'connected'));
      eventSource.addEventListener('ai.status', (e) => handleSSEMessage(e, 'ai.status'));
      eventSource.addEventListener('ai.chunk', (e) => handleSSEMessage(e, 'ai.chunk'));
      eventSource.addEventListener('ai.complete', (e) => handleSSEMessage(e, 'ai.complete'));
      eventSource.addEventListener('ai.error', (e) => handleSSEMessage(e, 'ai.error'));
      eventSource.addEventListener('timeout', (e) => handleSSEMessage(e, 'timeout'));

      // Handle connection errors
      eventSource.onerror = (err) => {
        console.error('❌ SSE connection error:', err);
        setError('Connection lost. Please try again.');
        setIsGenerating(false);
        eventSource.close();
        eventSourceRef.current = null;
      };

    } catch (err: any) {
      setError(err.message || 'Failed to start generation');
      setIsGenerating(false);
    }
  }, [userProfile, handleSSEMessage]);

  // Handle generate button click
  const handleGenerateRoutine = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    setStreamStatus('Initializing...');
    setStreamProgress(0);

    try {
      await generateRoutine();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to generate skincare routine";
      setError(errorMessage);
      setRetryCount(prev => prev + 1);
      console.error("❌ Generation error:", err);
      setIsGenerating(false);
    }
  }, [generateRoutine]);

  // Get display labels using shared mappers
  const skinTypeLabel = getSkinTypeLabel(userProfile.skinType);
  const skinConcernLabel = getSkinConcernLabel(userProfile.skinConcern);
  const routineTypeLabel = getRoutineTypeLabel(userProfile.routineType);

  return (
    <div className="space-y-6">
      {isGenerating && (
        <MultiStepLoader
          loadingStates={LOADING_STATES}
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
            <span className="font-medium">{skinTypeLabel}</span>
          </div>
          <div className="flex items-center justify-between border-b pb-2">
            <span className="text-muted-foreground">Main Concern</span>
            <span className="font-medium">{skinConcernLabel}</span>
          </div>
          <div className="flex items-center justify-between border-b pb-2">
            <span className="text-muted-foreground">Routine Preference</span>
            <span className="font-medium">{routineTypeLabel}</span>
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

      {/* Loading State with Progress */}
      {isGenerating && (
        <div className="rounded-lg bg-blue-50 p-4 text-blue-800">
          <div className="flex items-start gap-3">
            <Loader2 className="mt-0.5 h-5 w-5 animate-spin text-blue-600" />
            <div className="flex-1">
              <p className="font-medium">Generating your routine...</p>
              <p className="text-sm mb-2">
                {streamStatus || 'Our AI is analyzing products to find the perfect match for your skin.'}
              </p>
              {/* Progress bar */}
              <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full bg-blue-600 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${streamProgress}%` }}
                />
              </div>
              <p className="text-xs mt-1 text-blue-600">
                {streamProgress}% complete
              </p>
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
