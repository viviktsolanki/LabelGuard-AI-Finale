
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Circle,
  Loader2,
  Eye,
  FileSearch,
  Cpu,
  Map,
  AlignLeft,
  BookOpen,
  Layers,
  ArrowRight,
  AlertCircle,
  Lock,
  Wallet,
} from 'lucide-react';
import { getProductById, type ProductAnalysis } from '@/lib/mockData';
import AppImage from '@/components/ui/AppImage';

interface PipelineStage {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  durationMs: number;
}

const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: 'stage-read',
    label: 'Reading package',
    description: 'Decoding image format and preparing for vision analysis',
    icon: <BookOpen size={16} />,
    durationMs: 600,
  },
  {
    id: 'stage-ocr',
    label: 'Detecting declarations',
    description: 'Locating all text regions and mandatory declaration fields',
    icon: <AlignLeft size={16} />,
    durationMs: 900,
  },
  {
    id: 'stage-declarations',
    label: 'Extracting label text',
    description: 'Classifying text into structured declaration fields',
    icon: <FileSearch size={16} />,
    durationMs: 800,
  },
  {
    id: 'stage-spatial',
    label: 'Checking mandatory fields',
    description: 'Generating bounding boxes and spatial coordinates',
    icon: <Layers size={16} />,
    durationMs: 700,
  },
  {
    id: 'stage-readability',
    label: 'Analyzing readability',
    description: 'Estimating font size and visual clarity for each field',
    icon: <Eye size={16} />,
    durationMs: 600,
  },
  {
    id: 'stage-rules',
    label: 'Applying rule engine',
    description: 'Deterministic validation against compliance rule set',
    icon: <Cpu size={16} />,
    durationMs: 700,
  },
  {
    id: 'stage-map',
    label: 'Generating evidence map',
    description: 'Linking findings to evidence and generating compliance score',
    icon: <Map size={16} />,
    durationMs: 500,
  },
];

type StageState = 'pending' | 'running' | 'complete';

interface PendingUpload {
  name: string;
  category: string;
  imageDataUrl: string;
  capturedAt: string;
}

export default function AnalysisContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const productId = searchParams.get('product') || 'product-b-001';
  const mode = searchParams.get('mode') || 'demo';

  const [product] = useState<ProductAnalysis | null>(() =>
    mode === 'upload' ? null : (getProductById(productId) ?? null)
  );

  const [pendingUpload, setPendingUpload] =
    useState<PendingUpload | null>(null);

  const [stageStates, setStageStates] =
    useState<Record<string, StageState>>({});

  const [currentStageIndex, setCurrentStageIndex] = useState(-1);
  const [declarationsFound, setDeclarationsFound] = useState(0);
  const [complete, setComplete] = useState(false);
  const [navigating, setNavigating] = useState(false);

  // x402 payment UI state
  const [paymentUnlocked, setPaymentUnlocked] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);

  useEffect(() => {
    if (mode !== 'upload') return;

    try {
      const raw = sessionStorage.getItem('labelguard:pending-upload');

      if (raw) {
        setPendingUpload(JSON.parse(raw) as PendingUpload);
      }
    } catch {
      setPendingUpload(null);
    }
  }, [mode]);

  const runPipeline = useCallback(async () => {
    // Backend integration point:
    // replace this with real AI pipeline polling in production.
    let declCount = 0;

    for (let i = 0; i < PIPELINE_STAGES.length; i++) {
      const stage = PIPELINE_STAGES[i];

      setCurrentStageIndex(i);

      setStageStates((prev) => ({
        ...prev,
        [stage.id]: 'running',
      }));

      await new Promise((resolve) =>
        setTimeout(resolve, stage.durationMs)
      );

      setStageStates((prev) => ({
        ...prev,
        [stage.id]: 'complete',
      }));

      // Increment declarations found during identification stage
      if (stage.id === 'stage-declarations' && product) {
        const target = product.declarations.length;

        for (let d = 1; d <= target; d++) {
          await new Promise((resolve) => setTimeout(resolve, 60));
          declCount = d;
          setDeclarationsFound(declCount);
        }
      }
    }

    setComplete(true);
    setCurrentStageIndex(-1);
  }, [product]);

  useEffect(() => {
    if (mode === 'upload' || !product) return;

    const timer = setTimeout(runPipeline, 400);

    return () => clearTimeout(timer);
  }, [runPipeline, mode, product]);

  const handleViewResults = useCallback(() => {
    setNavigating(true);
    router.push(`/compliance-map?product=${productId}`);
  }, [router, productId]);

  /*
   * IMPORTANT:
   * The current working x402 payer lives in x402-server/client.js.
   * It uses the local AVM_MNEMONIC and must NOT be moved into this
   * browser component.
   *
   * For now this button provides the judge-facing paywall UI and
   * directs the demo operator to execute the real x402 payment flow.
   */
  const handleUnlockAnalysis = useCallback(async () => {
  setPaymentLoading(true);

  try {
    const response = await fetch('http://localhost:4022/api/pay', {
      method: 'POST',
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'x402 payment failed');
    }

    setPaymentUnlocked(true);
  } catch (error) {
    console.error('x402 payment error:', error);

    alert(
      error instanceof Error
        ? error.message
        : 'x402 payment failed. Please try again.'
    );
  } finally {
    setPaymentLoading(false);
  }
}, []);

  if (mode === 'upload') {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20">
            <Cpu size={12} className="text-accent" />
            <span className="text-xs font-semibold text-accent tracking-wide">
              Image received
            </span>
          </div>

          <h1 className="text-2xl font-extrabold text-navy">
            Ready for AI analysis
          </h1>

          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            Your label image was captured successfully. The live OCR/vision
            pipeline is the next integration step; no compliance result is
            fabricated for an arbitrary upload.
          </p>
        </div>

        <div className="card p-5">
          {pendingUpload?.imageDataUrl ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="relative aspect-[3/4] max-h-[520px] mx-auto w-full rounded-xl overflow-hidden bg-muted border border-border">
                <img
                  src={pendingUpload.imageDataUrl}
                  alt="Uploaded product label preview"
                  className="absolute inset-0 w-full h-full object-contain"
                />
              </div>

              <div className="space-y-4">
                <div>
                  <p className="section-label">Uploaded image</p>

                  <h2 className="text-lg font-bold text-navy mt-1 break-words">
                    {pendingUpload.name}
                  </h2>

                  <p className="text-sm text-muted-foreground mt-1">
                    Category: {pendingUpload.category}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-muted/50 space-y-2">
                  <p className="text-sm font-semibold text-navy">
                    Prototype boundary
                  </p>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Arbitrary uploads are captured and prepared here. The
                    current prototype uses deterministic Demo Products for the
                    complete evidence workflow until a production OCR/vision
                    service is connected.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => router.push('/')}
                    className="btn-secondary flex-1"
                  >
                    Choose another image
                  </button>

                  <button
                    onClick={() => router.push('/')}
                    className="btn-primary flex-1"
                  >
                    Try Demo Inspection
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center space-y-4">
              <AlertCircle
                size={40}
                className="text-review mx-auto"
              />

              <h2 className="text-lg font-bold text-navy">
                Upload preview unavailable
              </h2>

              <p className="text-sm text-muted-foreground">
                Return to Scan and upload the image again.
              </p>

              <button
                onClick={() => router.push('/')}
                className="btn-primary"
              >
                Back to Scan
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center space-y-4">
        <AlertCircle size={48} className="text-flag mx-auto" />

        <h2 className="text-xl font-bold text-navy">
          Product not found
        </h2>

        <p className="text-muted-foreground text-sm">
          The requested product analysis could not be loaded.
        </p>

        <button
          onClick={() => router.push('/')}
          className="btn-primary"
        >
          Back to Scan
        </button>
      </div>
    );
  }

  const completedCount = PIPELINE_STAGES.filter(
    (s) => stageStates[s.id] === 'complete'
  ).length;

  const progressPercent = Math.round(
    (completedCount / PIPELINE_STAGES.length) * 100
  );

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20">
          <Cpu size={12} className="text-accent" />

          <span className="text-xs font-semibold text-accent tracking-wide">
            {mode === 'demo' ? 'Demo Mode' : 'Live Analysis'}
          </span>
        </div>

        <h1 className="text-2xl font-extrabold text-navy">
          {complete ? 'Analysis Complete' : 'Analyzing Label...'}
        </h1>

        <p className="text-sm text-muted-foreground">
          {complete
            ? `${product.declarations.length} declarations extracted • ${product.flagCount} flags • ${product.reviewCount} reviews`
            : 'AI pipeline running — this takes a few seconds'}
        </p>
      </div>

      {/* Product card + pipeline */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Product thumbnail */}
        <div className="md:col-span-2">
          <div className="card p-4 h-full flex flex-col gap-4">
            <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden bg-muted">
              <AppImage
                src={product.imageUrl}
                alt={product.imageAlt}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 240px"
              />

              {/* Scanning overlay */}
              {!complete && (
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute inset-x-0 h-0.5 bg-accent/60 top-0 animate-scan-line" />
                  <div className="absolute inset-0 bg-gradient-to-b from-accent/5 to-transparent" />
                </div>
              )}

              {complete && (
                <div className="absolute inset-0 flex items-center justify-center bg-navy/20">
                  <div className="w-12 h-12 rounded-full bg-pass/90 flex items-center justify-center animate-bounce-in">
                    <CheckCircle2
                      size={24}
                      className="text-white"
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <p className="text-sm font-bold text-navy leading-tight">
                {product.name}
              </p>

              <p className="text-xs text-muted-foreground mt-0.5">
                {product.category}
              </p>
            </div>

            {/* Live counters */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-muted/50 text-center">
                <p className="text-xl font-extrabold text-navy font-tabular">
                  {declarationsFound}
                </p>

                <p className="text-xs text-muted-foreground">
                  Declarations
                </p>
              </div>

              <div className="p-3 rounded-xl bg-muted/50 text-center">
                <p className="text-xl font-extrabold text-accent font-tabular">
                  {progressPercent}%
                </p>

                <p className="text-xs text-muted-foreground">
                  Complete
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Pipeline stages */}
        <div className="md:col-span-3">
          <div className="card p-5 h-full flex flex-col gap-5">
            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  Pipeline progress
                </span>

                <span className="text-xs font-bold text-accent font-tabular">
                  {progressPercent}%
                </span>
              </div>

              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Stages */}
            <div className="space-y-2 flex-1">
              {PIPELINE_STAGES.map((stage, index) => {
                const state = stageStates[stage.id] || 'pending';
                const isRunning = state === 'running';
                const isDone = state === 'complete';

                return (
                  <div
                    key={stage.id}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${
                      isRunning
                        ? 'bg-accent/8 border border-accent/20'
                        : isDone
                          ? 'bg-pass-bg border border-pass-border/50'
                          : 'bg-muted/30 border border-transparent'
                    }`}
                  >
                    {/* Stage icon/status */}
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                        isRunning
                          ? 'bg-accent text-white'
                          : isDone
                            ? 'bg-pass text-white'
                            : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {isRunning ? (
                        <Loader2
                          size={14}
                          className="animate-spin"
                        />
                      ) : isDone ? (
                        <CheckCircle2 size={14} />
                      ) : (
                        <Circle size={14} />
                      )}
                    </div>

                    {/* Stage info */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-semibold transition-colors duration-200 ${
                          isRunning
                            ? 'text-accent'
                            : isDone
                              ? 'text-pass'
                              : 'text-muted-foreground'
                        }`}
                      >
                        {stage.label}
                      </p>

                      {(isRunning || isDone) && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {stage.description}
                        </p>
                      )}
                    </div>

                    {/* Stage icon */}
                    <div
                      className={`flex-shrink-0 transition-all duration-200 ${
                        isDone
                          ? 'text-pass'
                          : isRunning
                            ? 'text-accent'
                            : 'text-muted-foreground/30'
                      }`}
                    >
                      {stage.icon}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Complete state */}
            {complete && (
              <div className="space-y-3 animate-fade-in-up">
                <div className="p-4 rounded-xl bg-pass-bg border border-pass-border flex items-center gap-3">
                  <CheckCircle2
                    size={18}
                    className="text-pass flex-shrink-0"
                  />

                  <div>
                    <p className="text-sm font-bold text-pass">
                      Analysis complete
                    </p>

                    <p className="text-xs text-muted-foreground mt-0.5">
                      Quality score:{' '}
                      <strong className="text-navy">
                        {product.qualityScore}/100
                      </strong>

                      {' · '}

                      {product.flagCount > 0 && (
                        <span className="text-flag font-semibold">
                          {product.flagCount} flags
                        </span>
                      )}

                      {product.flagCount > 0 &&
                        product.reviewCount > 0 &&
                        ' · '}

                      {product.reviewCount > 0 && (
                        <span className="text-review font-semibold">
                          {product.reviewCount} reviews
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* x402 Paywall */}
                {!paymentUnlocked ? (
                  <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                        <Lock
                          size={17}
                          className="text-accent"
                        />
                      </div>

                      <div className="flex-1">
                        <p className="text-sm font-bold text-navy">
                          AI Compliance Analysis
                        </p>

                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          Unlock the verified compliance evidence workflow
                          using an x402 pay-per-analysis request on Algorand
                          Testnet.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/60 border border-accent/10">
                      <span className="text-xs font-semibold text-muted-foreground">
                        x402 access fee
                      </span>

                      <span className="text-sm font-extrabold text-navy">
                        0.10 USDC
                      </span>
                    </div>

                    <button
                      onClick={handleUnlockAnalysis}
                      disabled={paymentLoading}
                      className="btn-primary w-full py-3.5 text-base font-bold"
                    >
                      {paymentLoading ? (
                        <>
                          <Loader2
                            size={16}
                            className="animate-spin"
                          />
                          Preparing x402 Payment...
                        </>
                      ) : (
                        <>
                          <Wallet size={16} />
                          Unlock AI Compliance Analysis
                          <ArrowRight size={16} />
                        </>
                      )}
                    </button>

                    <p className="text-[11px] text-center text-muted-foreground">
                      Powered by x402 • Algorand Testnet • USDC
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-pass-bg border border-pass-border flex items-center gap-3">
                      <CheckCircle2
                        size={18}
                        className="text-pass flex-shrink-0"
                      />

                      <div>
                        <p className="text-sm font-bold text-pass">
                          x402 payment verified
                        </p>

                        <p className="text-xs text-muted-foreground mt-0.5">
                          Paid analysis access unlocked.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={handleViewResults}
                      disabled={navigating}
                      className="btn-primary w-full py-3.5 text-base font-bold"
                    >
                      {navigating ? (
                        <>
                          <Loader2
                            size={16}
                            className="animate-spin"
                          />
                          Opening Compliance Map...
                        </>
                      ) : (
                        <>
                          <Map size={16} />
                          View Compliance Map
                          <ArrowRight size={16} />
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Architecture note */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold text-navy">
            AI Pipeline:
          </span>

          {[
            'Vision AI',
            'OCR Engine',
            'NLP Classifier',
            'Spatial Analysis',
            'Readability Estimator',
            'Rule Engine',
            'Evidence Graph',
          ].map((step, i) => (
            <React.Fragment key={`pipe-${step}`}>
              <span className="px-2 py-0.5 rounded-md bg-muted font-medium">
                {step}
              </span>

              {i < 6 && (
                <ArrowRight
                  size={10}
                  className="text-muted-foreground/40"
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

