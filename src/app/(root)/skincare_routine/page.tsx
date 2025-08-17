"use client"
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter} from 'next/navigation';
import { RoutineStep,WeeklyTreatment,SkincareData, UserPreferences,GetRoutineResponse } from '@/lib/types';
import { ChevronRight, Download, Home, RotateCcw, AlertTriangle, RefreshCw } from 'lucide-react';
import Navbar from '@/components/Navbar';

enum LoadingState {
  POLLING = 'polling',
  COMPLETED = 'completed',
  ERROR = 'error',
  TIMEOUT = 'timeout'
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

function SkincarePollingResults({
  searchParams,
}: PageProps) {
  const router = useRouter();
  const [resolvedSearchParams, setResolvedSearchParams] = useState<{ [key: string]: string | undefined } | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.POLLING);
  const [skincareData, setSkincareData] = useState<SkincareData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [activeRoutine, setActiveRoutine] = useState<'morning' | 'evening'>('morning');
  const [pollingAttempt, setPollingAttempt] = useState(0);
  const [showTransition, setShowTransition] = useState(false);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadingStateRef = useRef<LoadingState>(LoadingState.POLLING);
  const isPollingActiveRef = useRef(true);

  // Constants
  const POLLING_INTERVAL = 7500; // 7.5 seconds
  const MAX_POLLING_ATTEMPTS = 40; // ~5 minutes total
  const TIMEOUT_DURATION = 300000; // 5 minutes

  // Resolve searchParams promise
  useEffect(() => {
    const resolveParams = async () => {
      try {
        const params = await searchParams;
        setResolvedSearchParams(params);
      } catch (error) {
        console.error('Error resolving search params:', error);
        setError('Failed to load search parameters.');
        setLoadingState(LoadingState.ERROR);
      }
    };

    resolveParams();
  }, [searchParams]);

  // Keep ref in sync with state
  useEffect(() => {
    loadingStateRef.current = loadingState;
  }, [loadingState]);

  const userPreferences: UserPreferences | null = useMemo(() => {
    try {
      if (!resolvedSearchParams?.skinType || !resolvedSearchParams?.skinConcern) return null;
      return { 
        skinType: resolvedSearchParams.skinType.trim(), 
        skinConcern: resolvedSearchParams.skinConcern.trim() 
      };
    } catch {
      return null;
    }
  }, [resolvedSearchParams]);

  const cleanup = useCallback(() => {
    isPollingActiveRef.current = false;
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const pollForRoutine = useCallback(async () => {
    if (!userPreferences || !isPollingActiveRef.current) return false;

    try {
      abortControllerRef.current = new AbortController();
      const params = new URLSearchParams({
        skinType: userPreferences.skinType,
        skinConcern: userPreferences.skinConcern,
      });

      console.log(`[Polling] Attempt ${pollingAttempt + 1}/${MAX_POLLING_ATTEMPTS} - Checking...`);

      const response = await fetch(`/api/get-routine?${params.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`[Polling] Routine not ready (404), continuing...`);
          return false;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText || 'Failed to fetch'}`);
      }

      const result: GetRoutineResponse = await response.json();

      if (result.success && result.data?.routine?.morning && result.data?.routine?.evening) {
        console.log(`[Polling] ✅ Routine found! Stopping polling`);
        setSkincareData(result.data);
        setLoadingState(LoadingState.COMPLETED);
        setShowTransition(true);
        cleanup(); // ✅ stop everything
        return true;
      }

      console.log(`[Polling] No routine yet: ${result.message || 'Still processing'}`);
      return false;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('[Polling] Request aborted');
        abortControllerRef.current = null;
        return false;
      }
      console.error(`[Polling] Error:`, error.message);
      return false;
    }
  }, [userPreferences, pollingAttempt, cleanup]);

  // Start polling
  const startPolling = useCallback(() => {
    if (!userPreferences) {
      setError('Missing required preferences. Please retake the quiz.');
      setLoadingState(LoadingState.ERROR);
      return;
    }

    console.log('[Polling] Starting...');
    setLoadingState(LoadingState.POLLING);
    setError(null);
    setPollingAttempt(0);
    startTimeRef.current = Date.now();
    isPollingActiveRef.current = true;

    // Initial poll
    pollForRoutine().then((success) => {
      if (!success && loadingStateRef.current === LoadingState.POLLING) {
        pollingIntervalRef.current = setInterval(async () => {
          setPollingAttempt(prev => {
            const newAttempt = prev + 1;
            if (newAttempt >= MAX_POLLING_ATTEMPTS) {
              console.log('[Polling] ❌ Max attempts reached');
              cleanup();
              setLoadingState(LoadingState.TIMEOUT);
              setError('Your routine is taking longer than expected. Please try again.');
              return prev;
            }
            pollForRoutine(); // will cleanup itself on success
            return newAttempt;
          });
        }, POLLING_INTERVAL);
      }
    });

    // Global timeout
    timeoutRef.current = setTimeout(() => {
      if (loadingStateRef.current === LoadingState.POLLING) {
        console.log('[Polling] ⏰ Timeout reached');
        cleanup();
        setLoadingState(LoadingState.TIMEOUT);
        setError('Your routine generation timed out. Please try again.');
      }
    }, TIMEOUT_DURATION);
  }, [userPreferences, pollForRoutine, cleanup]);

  // Retry mechanism
  const handleRetry = useCallback(() => {
    cleanup();
    setError(null);
    setSkincareData(null);
    setShowTransition(false);
    setPollingAttempt(0);
    startPolling();
  }, [cleanup, startPolling]);

  // Navigation
  const handleNavigateHome = useCallback(() => {
    cleanup();
    router.push('/');
  }, [cleanup, router]);

  const handleRetakeQuiz = useCallback(() => {
    cleanup();
    router.push('/quiz');
  }, [cleanup, router]);

  // Init on mount - only start polling when we have resolved params
  useEffect(() => {
    if (!resolvedSearchParams) return; // Wait for params to resolve

    if (!userPreferences) {
      setError('Invalid preferences. Please retake the quiz.');
      setLoadingState(LoadingState.ERROR);
      return;
    }
    const initTimer = setTimeout(() => startPolling(), 500);
    return () => {
      clearTimeout(initTimer);
      cleanup();
    };
  }, [resolvedSearchParams, userPreferences, startPolling, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Memoized computations for performance
  const currentRoutineSteps = useMemo(() => {
    return skincareData?.routine[activeRoutine] || [];
  }, [skincareData, activeRoutine]);

  const { doTips, dontTips } = useMemo(() => {
    const tips = skincareData?.general_notes_and_tips || [];
    return {
      doTips: tips.slice(0, Math.max(3, Math.floor(tips.length / 2))),
      dontTips: [
        "Don't skip patch testing new products on sensitive areas",
        "Don't forget broad-spectrum sunscreen, even indoors or on cloudy days",
        "Don't over-exfoliate or introduce multiple actives simultaneously",
        "Don't ignore your skin's feedback - adjust frequency as needed"
      ]
    };
  }, [skincareData]);

  // Show initial loading while resolving params
  if (!resolvedSearchParams) {
    return (
      <div className="bg-gradient-to-br from-[#7772E7] via-[#9A68EB] to-[#D881F5F5] min-h-screen p-4 sm:p-6">
        <div className="flex items-center justify-center p-4 mb-16">
          <Navbar />
        </div>
        
        <div className="max-w-4xl mx-auto flex items-center justify-center min-h-[400px]">
          <div className="bg-white/25 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/30 text-center">
            <div className="flex items-center justify-center mb-6">
              <RefreshCw className="w-12 h-12 text-white animate-spin" />
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-4">
              Loading...
            </h2>
          </div>
        </div>
      </div>
    );
  }

  // Polling status indicator
  const PollingIndicator = () => {
    const elapsedTime = Math.floor((Date.now() - startTimeRef.current) / 1000);
    
    return (
      <div className="flex items-center gap-3 text-sm">
        <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
        <span className="text-blue-400 font-medium">
          Checking for your routine... ({pollingAttempt + 1}/{MAX_POLLING_ATTEMPTS})
        </span>
        <span className="text-blue-300">
          {elapsedTime}s
        </span>
      </div>
    );
  };

  // Error state component
  const ErrorState = () => (
    <div className="bg-red-500/10 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-red-500/20">
      <div className="text-center">
        <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-red-300 mb-4">
          {loadingState === LoadingState.TIMEOUT ? 'Taking Longer Than Expected' : 'Something Went Wrong'}
        </h2>
        <p className="text-red-200 mb-6 max-w-md mx-auto">{error}</p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={handleRetry}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all duration-300"
          >
            <RefreshCw className="w-5 h-5" />
            Try Again
          </button>
          
          <button
            onClick={handleRetakeQuiz}
            className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all duration-300"
          >
            <RotateCcw className="w-5 h-5" />
            Retake Quiz
          </button>
          
          <button
            onClick={handleNavigateHome}
            className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all duration-300"
          >
            <Home className="w-5 h-5" />
            Go Home
          </button>
        </div>
      </div>
    </div>
  );

  // Show error or timeout state
  if (loadingState === LoadingState.ERROR || loadingState === LoadingState.TIMEOUT) {
    return (
      <div className="bg-gradient-to-br from-[#7772E7] via-[#9A68EB] to-[#D881F5F5] min-h-screen p-4 sm:p-6">
        <div className="flex items-center justify-center p-4 mb-16">
          <Navbar />
        </div>
        <div className="max-w-4xl mx-auto">
          <ErrorState />
        </div>
      </div>
    );
  }

  // Simple loading state - removed MultiStepLoader and 800ms delay
  if (loadingState === LoadingState.POLLING || !showTransition) {
    return (
      <div className="bg-gradient-to-br from-[#7772E7] via-[#9A68EB] to-[#D881F5F5] min-h-screen p-4 sm:p-6">
        <div className="flex items-center justify-center p-4 mb-16">
          <Navbar />
        </div>
        
        <div className="max-w-4xl mx-auto flex items-center justify-center min-h-[400px]">
          <div className="bg-white/25 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/30 text-center">
            <div className="flex items-center justify-center mb-6">
              <RefreshCw className="w-12 h-12 text-white animate-spin" />
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-4">
              Crafting Your Perfect Routine
            </h2>
            
            <p className="text-white/80 mb-6">
              Our AI is analyzing your skin profile and matching you with the perfect products...
            </p>
            
            <div className="bg-white/20 rounded-lg p-4">
              <PollingIndicator />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main results view
  return (
    <div className="bg-gradient-to-br from-[#7772E7] via-[#9A68EB] to-[#D881F5F5] p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-center p-4 mb-16">
        <Navbar />
      </div>

      {/* Success indicator */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex justify-between items-center text-white/70 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="text-green-400 font-medium">Routine Ready</span>
          </div>
          <span>Found after {pollingAttempt + 1} check{pollingAttempt !== 0 ? 's' : ''}</span>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Results header */}
        <div className="bg-white/25 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-white/30">
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-[#161326] mb-4">
              Your Personalized Skincare Routine
            </h1>
            <p className="text-[#161326]/80 text-lg">
              Crafted specifically for your <span className="font-semibold">{userPreferences?.skinType}</span> skin 
              with focus on <span className="font-semibold">{userPreferences?.skinConcern}</span>
            </p>
          </div>
        </div>

        {/* Custom Routine Section */}
        <div className="bg-white/25 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-white/30">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#161326] text-center mb-8">
            Daily Routine
          </h2>
          
          {/* Routine Toggle */}
          <div className="flex justify-center mb-8">
            <div className="bg-white/20 p-1 rounded-xl">
              <button
                onClick={() => setActiveRoutine('morning')}
                className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
                  activeRoutine === 'morning' 
                    ? 'bg-white text-purple-600 shadow-lg' 
                    : 'text-white hover:bg-white/10'
                }`}
              >
                ☀️ Morning Routine
              </button>
              <button
                onClick={() => setActiveRoutine('evening')}
                className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
                  activeRoutine === 'evening' 
                    ? 'bg-white text-purple-600 shadow-lg' 
                    : 'text-white hover:bg-white/10'
                }`}
              >
                🌙 Evening Routine
              </button>
            </div>
          </div>

          {/* Routine Steps */}
          <div className="space-y-4">
            {currentRoutineSteps.map((step, index) => (
              <div 
                key={`${activeRoutine}-${step.step}-${index}`} 
                className="bg-[#F3E9FF26] backdrop-blur-sm rounded-xl p-5 border border-white/20 hover:bg-white/20 transition-all duration-300 hover:shadow-lg"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-white text-[#161326] rounded-full flex items-center justify-center font-bold text-sm shadow-sm">
                    {step.step}
                  </div>
                  <span className="text-[#161326] text-base font-semibold">Step {step.step}</span>
                </div>
                
                <h4 className="text-[#161326] font-bold text-base mb-3 leading-tight">
                  {step.product_name}
                </h4>
                
                <p className="text-[#161326]/80 text-sm mb-3 leading-relaxed">
                  <span className="font-medium">Why this works: </span>
                  {step.why_chosen}
                </p>
                
                <p className="text-[#161326]/70 text-sm mb-4 leading-relaxed">
                  <span className="font-medium">How to use: </span>
                  {step.how_to_use}
                </p>
                
                {step.product_url && step.product_url !== 'N/A' && (
                  <a 
                    href={step.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-[#161326] hover:text-purple-600 text-sm font-semibold transition-colors duration-200 hover:underline"
                  >
                    🛒 View Product <ChevronRight className="w-4 h-4" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Weekly Treatments */}
        {skincareData?.weekly_treatments && skincareData.weekly_treatments.length > 0 && (
          <div className="bg-white/25 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-white/30">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#161326] text-center mb-8">
              Weekly Treatments
            </h2>
            <div className="space-y-4">
              {skincareData.weekly_treatments.map((treatment, index) => (
                <div key={index} className="bg-[#F3E9FF26] backdrop-blur-sm rounded-xl p-5 border border-white/20">
                  <h4 className="text-[#161326] font-bold text-base mb-2">{treatment.treatment_type}</h4>
                  <p className="text-[#161326] font-semibold text-sm mb-2">{treatment.product_name}</p>
                  <p className="text-[#161326]/80 text-sm mb-2">{treatment.why_chosen}</p>
                  <p className="text-[#161326]/70 text-sm">{treatment.how_to_use}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Do's & Don'ts Section */}
        <div className="bg-white/25 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-white/30">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#161326] text-center mb-8">
            Essential Guidelines
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-bold text-green-300 mb-6 flex items-center gap-3">
                <span className="text-2xl">✅</span> Do&apos;s
              </h3>
              <ul className="space-y-4">
                {doTips.map((tip, index) => (
                  <li key={index} className="text-[#161326] text-sm flex items-start gap-3 leading-relaxed">
                    <span className="text-green-400 mt-1 text-lg">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <h3 className="text-xl font-bold text-red-300 mb-6 flex items-center gap-3">
                <span className="text-2xl">❌</span> Don&apos;ts
              </h3>
              <ul className="space-y-4">
                {dontTips.map((tip, index) => (
                  <li key={index} className="text-[#161326] text-sm flex items-start gap-3 leading-relaxed">
                    <span className="text-red-400 mt-1 text-lg">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-white/30">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <button 
              onClick={handleNavigateHome}
              className="flex items-center gap-2 text-white/80 hover:text-white transition-colors duration-200 font-medium"
            >
              <Home className="w-5 h-5" />
              Home Page
            </button>
            
            <button 
              onClick={handleRetakeQuiz}
              className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              <RotateCcw className="w-5 h-5" />
              Retake Quiz
            </button>
            
            <button 
              onClick={() => {
                // Implement download functionality
                console.log('Download routine report');
              }}
              className="flex items-center gap-2 text-white/80 hover:text-white transition-colors duration-200 font-medium"
            >
              <Download className="w-5 h-5" />
              Download Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkincarePollingResults;