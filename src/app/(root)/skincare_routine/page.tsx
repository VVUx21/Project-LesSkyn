"use client"
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { SkincareData, UserPreferences, RoutineStep } from '@/lib/types';
import { ChevronRight, Download, Home, RotateCcw, AlertTriangle, RefreshCw, Sparkles } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { exportRoutineReport } from '@/lib/utils';

enum LoadingState {
  LOADING = 'loading',
  STREAMING = 'streaming',
  COMPLETED = 'completed',
  ERROR = 'error'
}

interface StreamMessage {
  event: string;
  data: any;
  timestamp: number;
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

function SkincareResults({
  searchParams,
}: PageProps) {
  const router = useRouter();
  const [resolvedSearchParams, setResolvedSearchParams] = useState<{ [key: string]: string | undefined } | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.LOADING);
  const [skincareData, setSkincareData] = useState<SkincareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [streamStatus, setStreamStatus] = useState<string>('');
  const [streamProgress, setStreamProgress] = useState<number>(0);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const [activeRoutine, setActiveRoutine] = useState<'morning' | 'evening'>('morning');

  // Resolve searchParams promise
  useEffect(() => {
    const resolveParams = async () => {
      try {
        const params = await searchParams;
        console.log(params);
        setResolvedSearchParams(params);
      } catch (error) {
        console.error('Error resolving search params:', error);
        setError('Failed to load search parameters.');
        setLoadingState(LoadingState.ERROR);
      }
    };

    resolveParams();
  }, [searchParams]);

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

  // Poll for channel messages
  const pollChannel = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch(`/api/getmyroutine/channel/${sessionId}`);
      const result = await response.json();
      
      if (!result.success || !result.messages) return;

      for (const msg of result.messages as StreamMessage[]) {
        if (msg.event === 'ai.status') {
          setStreamStatus(msg.data.message || msg.data.type);
          if (msg.data.type === 'generating') {
            setStreamProgress(30);
          } else if (msg.data.type === 'products_loaded') {
            setStreamProgress(20);
          }
        } else if (msg.event === 'ai.chunk') {
          // Update progress based on chunks received
          const progress = Math.min(90, 30 + (msg.data.chunksReceived || 0) * 2);
          setStreamProgress(progress);
        } else if (msg.event === 'ai.complete') {
          setStreamProgress(100);
          setSkincareData(msg.data.routine);
          setLoadingState(LoadingState.COMPLETED);
          // Stop polling
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          return;
        } else if (msg.event === 'ai.error') {
          setError(msg.data.error || 'An error occurred');
          setLoadingState(LoadingState.ERROR);
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          return;
        }
      }
    } catch (err) {
      console.error('Polling error:', err);
    }
  }, []);

  // Start realtime generation
  const startRealtimeGeneration = useCallback(async () => {
    if (!userPreferences) return;

    const sessionId = `routine_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    sessionIdRef.current = sessionId;
    
    setLoadingState(LoadingState.STREAMING);
    setStreamStatus('Starting routine generation...');
    setStreamProgress(5);

    try {
      const response = await fetch('/api/getmyroutine/realtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          skinType: userPreferences.skinType,
          skinConcern: userPreferences.skinConcern,
          commitmentLevel: 'Standard',
          preferredProducts: 'Natural/Organic Products',
          limit: 150
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to start generation');
      }

      // Start polling for updates
      pollingRef.current = setInterval(() => pollChannel(sessionId), 1000);

      // Timeout after 2 minutes
      setTimeout(() => {
        if (pollingRef.current && loadingState === LoadingState.STREAMING) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
          setError('Generation timed out. Please try again.');
          setLoadingState(LoadingState.ERROR);
        }
      }, 120000);

    } catch (err: any) {
      setError(err.message || 'Failed to start generation');
      setLoadingState(LoadingState.ERROR);
    }
  }, [userPreferences, pollChannel, loadingState]);

  const fetchRoutine = useCallback(async () => {
    if (!userPreferences) {
      setError('Missing required preferences. Please retake the quiz.');
      setLoadingState(LoadingState.ERROR);
      return;
    }

    try {
      setLoadingState(LoadingState.LOADING);
      setError(null);

      const params = new URLSearchParams({
        skinType: userPreferences.skinType,
        skinConcern: userPreferences.skinConcern,
      });

      console.log('Fetching routine...');

      const response = await fetch(`/api/get-routine?${params.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      });

      if (!response.ok) {
        // If no cached routine, start realtime generation
        if (response.status === 404) {
          console.log('No cached routine found, starting realtime generation...');
          await startRealtimeGeneration();
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText || 'Failed to fetch'}`);
      }

      const result = await response.json();

      if (result.success && result.data?.routine?.morning && result.data?.routine?.evening) {
        console.log('✅ Routine found!');
        setSkincareData(result.data);
        setLoadingState(LoadingState.COMPLETED);
      } else {
        // No cached routine, start realtime generation
        console.log('No routine data, starting realtime generation...');
        await startRealtimeGeneration();
      }
    } catch (error: any) {
      console.error('Fetch error:', error.message);
      setError(error.message || 'Failed to load routine');
      setLoadingState(LoadingState.ERROR);
    }
  }, [userPreferences, startRealtimeGeneration]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // Navigation
  const handleNavigateHome = useCallback(() => {
    router.push('/');
  }, [router]);

  const handleRetakeQuiz = useCallback(() => {
    router.push('/onboarding');
  }, [router]);

  const handleRetry = useCallback(() => {
    setError(null);
    setSkincareData(null);
    fetchRoutine();
  }, [fetchRoutine]);

  // Init on mount - fetch routine when we have resolved params
  useEffect(() => {
    if (!resolvedSearchParams) return; // Wait for params to resolve

    if (!userPreferences) {
      setError('Invalid preferences. Please retake the quiz.');
      setLoadingState(LoadingState.ERROR);
      return;
    }
    
    fetchRoutine();
  }, [resolvedSearchParams, userPreferences, fetchRoutine]);

  // Memoized computations for performance
  const currentRoutineSteps = useMemo(() => {
    return skincareData?.routine[activeRoutine] || [];
  }, [skincareData, activeRoutine]);

  const { doTips, dontTips } = useMemo(() => {
    const tips = skincareData?.general_notes_and_tips || [];
    return {
      doTips:[
      'Consistency is key: Adhere to your routine daily for best results.',
      'Patch test new products: Always test a new product on a small area of your skin before applying it to your entire face to check for any adverse reactions.',
      "Listen to your skin: Adjust the frequency of active ingredients (like future retinol or AHAs) based on your skin's tolerance. If irritation occurs, reduce usage.",
      'Hydration is crucial: Even with normal skin, ensuring adequate hydration helps maintain skin barrier health and supports anti-aging efforts.',
      'Sun protection is non-negotiable: Always use a broad-spectrum sunscreen in the morning, regardless of the weather, to protect against UV damage, which is a primary cause of premature aging.'
    ],
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

  // Error state component
  const ErrorState = () => (
    <div className="bg-red-500/10 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-red-500/20">
      <div className="text-center">
        <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-red-300 mb-4">
          Something Went Wrong
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

  // Show error state
  if (loadingState === LoadingState.ERROR) {
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

  // Loading state
  if (loadingState === LoadingState.LOADING) {
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
              Loading Your Routine
            </h2>
            
            <p className="text-white/80 mb-6">
              Fetching your personalized skincare routine...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Streaming state - Real-time AI generation
  if (loadingState === LoadingState.STREAMING) {
    return (
      <div className="bg-gradient-to-br from-[#7772E7] via-[#9A68EB] to-[#D881F5F5] min-h-screen p-4 sm:p-6">
        <div className="flex items-center justify-center p-4 mb-16">
          <Navbar />
        </div>
        
        <div className="max-w-4xl mx-auto flex items-center justify-center min-h-[400px]">
          <div className="bg-white/25 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/30 text-center w-full max-w-md">
            <div className="flex items-center justify-center mb-6">
              <div className="relative">
                <Sparkles className="w-16 h-16 text-white animate-pulse" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full animate-ping" />
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-4">
              🧪 AI Creating Your Routine
            </h2>
            
            <p className="text-white/90 mb-6 text-lg">
              {streamStatus || 'Analyzing your skin profile...'}
            </p>
            
            {/* Progress bar */}
            <div className="w-full bg-white/20 rounded-full h-3 mb-4 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${streamProgress}%` }}
              />
            </div>
            
            <p className="text-white/70 text-sm">
              {streamProgress}% complete
            </p>
            
            <div className="mt-6 flex items-center justify-center gap-2 text-white/60 text-sm">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Processing with OpenAI...</span>
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
                  {step.reasoning}
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
                  <p className="text-[#161326]/70 text-sm mb-4">{treatment.recommendation}</p>
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
            disabled={isGeneratingPDF || !skincareData}
            onClick={async () => {
              if (!skincareData || !userPreferences) return;
              try {
                setIsGeneratingPDF(true);
                exportRoutineReport(skincareData, userPreferences, doTips, dontTips);
              } finally {
                setIsGeneratingPDF(false);
              }
            }}
            className={`flex items-center gap-2 font-medium transition-all duration-200 ${
              isGeneratingPDF
                ? "text-white/50 cursor-not-allowed"
                : "text-white/80 hover:text-white"
            }`}
          >
            {isGeneratingPDF ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Generating Report...
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Download Report
              </>
            )}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkincareResults;