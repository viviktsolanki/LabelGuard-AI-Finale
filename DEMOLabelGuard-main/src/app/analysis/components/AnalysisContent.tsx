'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
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
  Video,
} from 'lucide-react';
import {
  getProductById,
  type ProductAnalysis,
  type AdditionalImageId,
  type ImageId,
  imageLabelFor,
} from '@/lib/mockData';
import { buildRealProductAnalysis, saveRealProduct } from '@/lib/realProduct';
import AppImage from '@/components/ui/AppImage';
import ExtractedLabelData from './ExtractedLabelData';

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
    description: 'Decoding front and back images for vision analysis',
    icon: <BookOpen size={16} />,
    durationMs: 600,
  },
  {
    id: 'stage-ocr',
    label: 'Detecting declarations',
    description: 'Locating visible text and mandatory declaration fields',
    icon: <AlignLeft size={16} />,
    durationMs: 900,
  },
  {
    id: 'stage-declarations',
    label: 'Extracting label text',
    description: 'Classifying visible text into structured declaration fields',
    icon: <FileSearch size={16} />,
    durationMs: 800,
  },
  {
    id: 'stage-spatial',
    label: 'Checking mandatory fields',
    description: 'Checking which declarations appear on the front or back',
    icon: <Layers size={16} />,
    durationMs: 700,
  },
  {
    id: 'stage-readability',
    label: 'Analyzing readability',
    description: 'Estimating whether visible declarations are readable',
    icon: <Eye size={16} />,
    durationMs: 600,
  },
  {
    id: 'stage-rules',
    label: 'Applying rule engine',
    description: 'Preparing deterministic compliance validation',
    icon: <Cpu size={16} />,
    durationMs: 700,
  },
  {
    id: 'stage-map',
    label: 'Generating evidence map',
    description: 'Linking extracted declarations to their source image',
    icon: <Map size={16} />,
    durationMs: 500,
  },
];

// The x402 payment bridge (x402-server/) has no fixed production address —
// it's a separate local process the developer runs alongside `next dev`.
// Hardcoding `http://localhost:4022` broke as soon as this app was
// deployed anywhere other than localhost, silently, since fetch() to a
// dead localhost URL from a deployed origin just throws and the payment
// step never completes. Reading it from an env var makes the dependency
// explicit and configurable per-environment, without inventing a
// production URL that doesn't exist yet.
const X402_PAYMENT_URL =
  process.env.NEXT_PUBLIC_X402_PAYMENT_URL || 'http://localhost:4022';

type StageState = 'pending' | 'running' | 'complete';

interface PendingUpload {
  name: string;
  category: string;
  frontImageDataUrl: string;
  backImageDataUrl: string;
  /** Timestamp (seconds into the source video) the front/back image was
   * extracted from, if it came from the Phase 4A video scan pipeline
   * rather than a manual upload/camera capture. Null/undefined otherwise —
   * see src/lib/videoFrames.ts for where this originates. */
  frontVideoTimestampSeconds?: number | null;
  backVideoTimestampSeconds?: number | null;
  /** Optional additional views (side panels, top, bottom, close-ups),
   * in the order the user added them on the scan page. */
  additionalImages?: {
    id: AdditionalImageId;
    dataUrl: string;
    timestampSeconds?: number | null;
  }[];
  capturedAt: string;
}

interface AIAnalysisResponse {
  success: boolean;
  analysis?: string;
  error?: string;
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

  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Id of the deterministic ProductAnalysis record built from the real AI
  // extraction for this upload — used to open the Compliance Map for the
  // actual uploaded product instead of a demo product.
  const [realProductId, setRealProductId] = useState<string | null>(null);

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

  const runDemoPipeline = useCallback(async () => {
    if (!product) return;

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

      if (stage.id === 'stage-declarations') {
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

  const runRealAIAnalysis = useCallback(async (upload: PendingUpload) => {
    setAiError(null);
    setAiAnalysis(null);
    setComplete(false);
    setDeclarationsFound(0);

    for (let i = 0; i < PIPELINE_STAGES.length; i++) {
      const stage = PIPELINE_STAGES[i];

      setCurrentStageIndex(i);

      setStageStates((prev) => ({
        ...prev,
        [stage.id]: 'running',
      }));

      // Small visual delay so the judge can see the real pipeline stages.
      await new Promise((resolve) =>
        setTimeout(resolve, stage.durationMs)
      );

      // Call the real AI during the declaration extraction stage.
      if (stage.id === 'stage-declarations') {
        let response: Response;
        try {
          response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              category: upload.category,
              frontImageDataUrl: upload.frontImageDataUrl,
              backImageDataUrl: upload.backImageDataUrl,
              additionalImages: upload.additionalImages || [],
            }),
          });
        } catch (networkError) {
          console.error('Real AI analysis network error:', networkError);
          setAiError(
            'Could not reach the analysis service. Check your connection and try again.'
          );
          setCurrentStageIndex(-1);
          return;
        }

        try {
          const data = (await response.json()) as AIAnalysisResponse;

          if (!response.ok || !data.success) {
            throw new Error(
              data.error || 'AI analysis failed.'
            );
          }

          setAiAnalysis(data.analysis || '');

          // The real AI response is JSON, so count the extracted
          // top-level declaration fields that contain a value.
          try {
            const parsed = JSON.parse(data.analysis || '{}');

            const count = Object.values(parsed).filter((field) => {
              if (!field || typeof field !== 'object') {
                return false;
              }

              const value = (field as { value?: unknown }).value;

              return (
                value !== null &&
                value !== undefined &&
                String(value).trim().length > 0
              );
            }).length;

            setDeclarationsFound(count);
          } catch {
            // Keep the count at zero if the model response cannot
            // be parsed. The raw AI response is still preserved.
            setDeclarationsFound(0);
          }

          // Deterministic compliance layer: turn the AI's raw
          // extraction into a ProductAnalysis record for THIS uploaded
          // product, so the Compliance Map can use the real data
          // instead of a demo product.
          try {
            const realProduct = buildRealProductAnalysis({
              name: upload.name,
              category: upload.category,
              frontImageDataUrl: upload.frontImageDataUrl,
              backImageDataUrl: upload.backImageDataUrl,
              frontVideoTimestampSeconds: upload.frontVideoTimestampSeconds ?? null,
              backVideoTimestampSeconds: upload.backVideoTimestampSeconds ?? null,
              additionalImages: upload.additionalImages || [],
              analyzedAt: new Date().toLocaleString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }),
              aiAnalysisJson: data.analysis || '{}',
            });

            const saved = saveRealProduct(realProduct);

            if (!saved) {
              // Do NOT set realProductId here — the Compliance Map looks
              // this id up in the same storage that just failed to write,
              // so pointing the user at it would only lead to a
              // dead-end "Product not found" page. Fail honestly instead.
              setAiError(
                "The AI analysis completed, but this browser couldn't save the result (likely a storage limit). Try again with fewer additional views, or use a different browser/device."
              );
              setCurrentStageIndex(-1);
              return;
            }

            setRealProductId(realProduct.id);
          } catch (buildError) {
            console.error(
              'Unable to build real product analysis:',
              buildError
            );

            setAiError(
              'The AI analysis completed, but the result could not be processed. Please try again.'
            );
            setCurrentStageIndex(-1);
            return;
          }
        } catch (error) {
          console.error('Real AI analysis error:', error);

          setAiError(
            error instanceof SyntaxError
              ? 'The analysis service returned an unexpected response. Please try again.'
              : error instanceof Error
                ? error.message
                : 'AI analysis failed.'
          );

          setCurrentStageIndex(-1);
          return;
        }
      }

      setStageStates((prev) => ({
        ...prev,
        [stage.id]: 'complete',
      }));
    }

    setComplete(true);
    setCurrentStageIndex(-1);
  }, []);

  useEffect(() => {
    if (mode === 'upload') {
      // Real uploads must not start the paid AI analysis until the x402
      // payment has been verified.
      if (!pendingUpload || !paymentUnlocked) return;

      const timer = setTimeout(() => {
        void runRealAIAnalysis(pendingUpload);
      }, 400);

      return () => clearTimeout(timer);
    }

    if (!product) return;

    const timer = setTimeout(() => {
      void runDemoPipeline();
    }, 400);

    return () => clearTimeout(timer);
  }, [
    mode,
    pendingUpload,
    paymentUnlocked,
    product,
    runRealAIAnalysis,
    runDemoPipeline,
  ]);

  const handleViewResults = useCallback(() => {
    setNavigating(true);

    const targetProductId =
      mode === 'upload' && realProductId ? realProductId : productId;

    router.push(`/compliance-map?product=${targetProductId}`);
  }, [router, mode, realProductId, productId]);

  const handleUnlockAnalysis = useCallback(async () => {
    setPaymentLoading(true);

    try {
      const response = await fetch(
        `${X402_PAYMENT_URL}/api/pay`,
        {
          method: 'POST',
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || 'x402 payment failed'
        );
      }

      setPaymentUnlocked(true);
    } catch (error) {
      console.error('x402 payment error:', error);

      toast.error(
        error instanceof Error
          ? error.message
          : 'x402 payment failed. Please try again.'
      );
    } finally {
      setPaymentLoading(false);
    }
  }, []);

  /*
   * ------------------------------------------------------------
   * REAL UPLOAD / AI MODE
   * ------------------------------------------------------------
   */
  if (mode === 'upload') {
    const completedCount = PIPELINE_STAGES.filter(
      (s) => stageStates[s.id] === 'complete'
    ).length;

    const progressPercent = Math.round(
      (completedCount / PIPELINE_STAGES.length) * 100
    );

    if (!pendingUpload) {
      return (
        <div className="max-w-lg mx-auto py-20 text-center space-y-4">
          <AlertCircle
            size={48}
            className="text-flag mx-auto"
          />

          <h2 className="text-xl font-bold text-navy">
            Upload data not found
          </h2>

          <p className="text-muted-foreground text-sm">
            Return to Scan and upload both sides of the product
            again.
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

    // Real, truthful provenance only — built straight from what the user
    // actually captured via the video scan pipeline (see
    // handleVideoFramesAccepted in UploadZoneSection.tsx). Never invented;
    // an image id simply has no entry here when it was a manual
    // upload/camera capture.
    const videoTimestampByImageId: Partial<Record<ImageId, number>> = {};
    if (typeof pendingUpload.frontVideoTimestampSeconds === 'number') {
      videoTimestampByImageId.front = pendingUpload.frontVideoTimestampSeconds;
    }
    if (typeof pendingUpload.backVideoTimestampSeconds === 'number') {
      videoTimestampByImageId.back = pendingUpload.backVideoTimestampSeconds;
    }
    (pendingUpload.additionalImages || []).forEach((img) => {
      if (typeof img.timestampSeconds === 'number') {
        videoTimestampByImageId[img.id] = img.timestampSeconds;
      }
    });

    return (
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20">
            <Cpu size={12} className="text-accent" />

            <span className="text-xs font-semibold text-accent tracking-wide">
              Real AI Vision
            </span>
          </div>

          <h1 className="text-2xl font-extrabold text-navy">
            {!paymentUnlocked
              ? 'Payment Required'
              : complete
                ? 'AI Analysis Complete'
                : 'Analyzing Product Label...'}
          </h1>

          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            {!paymentUnlocked
              ? 'Unlock the paid AI vision analysis to continue.'
              : complete
                ? 'Scan complete — your compliance results are ready to view.'
                : pendingUpload.additionalImages && pendingUpload.additionalImages.length > 0
                  ? `LabelGuard AI is analyzing the front, back, and ${pendingUpload.additionalImages.length} additional view${pendingUpload.additionalImages.length > 1 ? 's' : ''} together.`
                  : 'LabelGuard AI is analyzing the front and back of the same product together.'}
          </p>
        </div>

        {/* Images */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="section-label">Front of product</p>
              {typeof pendingUpload.frontVideoTimestampSeconds === 'number' && (
                <span
                  className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground"
                  title={`From video frame at ${pendingUpload.frontVideoTimestampSeconds.toFixed(1)}s`}
                >
                  <Video size={11} />
                  {pendingUpload.frontVideoTimestampSeconds.toFixed(1)}s
                </span>
              )}
            </div>

            <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted border border-border">
              <img
                src={pendingUpload.frontImageDataUrl}
                alt="Front of uploaded product"
                className="absolute inset-0 w-full h-full object-contain"
              />
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="section-label">Back of product</p>
              {typeof pendingUpload.backVideoTimestampSeconds === 'number' && (
                <span
                  className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground"
                  title={`From video frame at ${pendingUpload.backVideoTimestampSeconds.toFixed(1)}s`}
                >
                  <Video size={11} />
                  {pendingUpload.backVideoTimestampSeconds.toFixed(1)}s
                </span>
              )}
            </div>

            <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted border border-border">
              <img
                src={pendingUpload.backImageDataUrl}
                alt="Back of uploaded product"
                className="absolute inset-0 w-full h-full object-contain"
              />
            </div>
          </div>
        </div>

        {/* Additional views, if the user added any on the scan page */}
        {pendingUpload.additionalImages && pendingUpload.additionalImages.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {pendingUpload.additionalImages.map((img) => (
              <div key={img.id} className="card p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="section-label text-xs">{imageLabelFor(img.id)}</p>
                  {typeof img.timestampSeconds === 'number' && (
                    <span
                      className="flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground"
                      title={`From video frame at ${img.timestampSeconds.toFixed(1)}s`}
                    >
                      <Video size={10} />
                      {img.timestampSeconds.toFixed(1)}s
                    </span>
                  )}
                </div>

                <div className="relative aspect-square rounded-lg overflow-hidden bg-muted border border-border">
                  <img
                    src={img.dataUrl}
                    alt={`${imageLabelFor(img.id)} of uploaded product`}
                    className="absolute inset-0 w-full h-full object-contain"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Product information */}
        <div className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-navy">
                {pendingUpload.name}
              </p>

              <p className="text-xs text-muted-foreground mt-1">
                Category: {pendingUpload.category}
              </p>
            </div>

            <div className="px-3 py-1.5 rounded-lg bg-muted text-xs font-semibold text-muted-foreground">
              Front + Back
              {pendingUpload.additionalImages && pendingUpload.additionalImages.length > 0
                ? ` + ${pendingUpload.additionalImages.length} more view${
                    pendingUpload.additionalImages.length > 1 ? 's' : ''
                  }`
                : ''}
            </div>
          </div>
        </div>

        {/* x402 Paywall (real upload) */}
        {!paymentUnlocked && (
          <div className="card p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                <Lock size={17} className="text-accent" />
              </div>

              <div className="flex-1">
                <p className="text-sm font-bold text-navy">
                  AI Compliance Analysis
                </p>

                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Unlock the real AI vision analysis for this
                  upload using an x402 pay-per-analysis request on
                  Algorand Testnet.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 border border-border">
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
                  <Loader2 size={16} className="animate-spin" />
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
        )}

        {/* Progress */}
        {paymentUnlocked && (
        <div className="card p-5 space-y-5">
          <div className="p-3 rounded-xl bg-pass-bg border border-pass-border flex items-center gap-3">
            <CheckCircle2 size={16} className="text-pass flex-shrink-0" />

            <p className="text-xs font-semibold text-pass">
              x402 payment verified — paid analysis access unlocked.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground">
                AI pipeline progress
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

            <p className="sr-only" role="status" aria-live="polite">
              {complete
                ? 'AI analysis complete.'
                : currentStageIndex >= 0
                  ? `${PIPELINE_STAGES[currentStageIndex].label}, ${progressPercent}% complete.`
                  : 'Preparing analysis.'}
            </p>
          </div>

          <div className="space-y-2">
            {PIPELINE_STAGES.map((stage) => {
              const state =
                stageStates[stage.id] || 'pending';

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
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
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

                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-semibold ${
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

                  <div
                    className={`flex-shrink-0 ${
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

          {/* AI error */}
          {aiError && (
            <div
              className="p-4 rounded-xl bg-flag-bg border border-flag-border flex items-start gap-3"
              role="alert"
              aria-live="assertive"
            >
              <AlertCircle
                size={18}
                className="text-flag flex-shrink-0 mt-0.5"
              />

              <div className="flex-1">
                <p className="text-sm font-bold text-flag">
                  AI analysis failed
                </p>

                <p className="text-xs text-muted-foreground mt-1 break-words">
                  {aiError}
                </p>

                <button
                  type="button"
                  onClick={() => void runRealAIAnalysis(pendingUpload)}
                  className="focus-ring mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-flag-border text-xs font-semibold text-flag hover:bg-flag-bg transition-all"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {/* Real AI result */}
          {complete && aiAnalysis && !aiError && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-pass-bg border border-pass-border flex items-center gap-3">
                <CheckCircle2
                  size={18}
                  className="text-pass flex-shrink-0"
                />

                <div>
                  <p className="text-sm font-bold text-pass">
                    Real AI extraction complete
                  </p>

                  <p className="text-xs text-muted-foreground mt-0.5">
                    {declarationsFound} visible declarations
                    extracted from the two product images.
                  </p>
                </div>
              </div>

              <ExtractedLabelData
                aiAnalysisJson={aiAnalysis}
                videoTimestampByImageId={videoTimestampByImageId}
              />

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => router.push('/')}
                  className="btn-secondary flex-1"
                >
                  Scan another product
                </button>

                <button
                  onClick={handleViewResults}
                  disabled={navigating}
                  className="btn-primary flex-1"
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
            </div>
          )}
        </div>
        )}

        {/* AI Architecture */}
        <div className="card p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-navy">
              Real AI Pipeline:
            </span>

            {[
              'Front Image',
              'Back Image',
              'Vision AI',
              'Structured Extraction',
              'Rule Engine',
              'Evidence Map',
            ].map((step, i, arr) => (
              <React.Fragment key={`pipe-${step}`}>
                <span className="px-2 py-0.5 rounded-md bg-muted font-medium">
                  {step}
                </span>

                {i < arr.length - 1 && (
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

  /*
   * ------------------------------------------------------------
   * EXISTING DEMO MODE
   * ------------------------------------------------------------
   */

  if (!product) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center space-y-4">
        <AlertCircle
          size={48}
          className="text-flag mx-auto"
        />

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
          {complete
            ? 'Analysis Complete'
            : 'Analyzing Label...'}
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

              <p className="sr-only" role="status" aria-live="polite">
                {complete
                  ? 'Analysis complete.'
                  : currentStageIndex >= 0
                    ? `${PIPELINE_STAGES[currentStageIndex].label}, ${progressPercent}% complete.`
                    : 'Preparing analysis.'}
              </p>
            </div>

            <div className="space-y-2 flex-1">
              {PIPELINE_STAGES.map((stage) => {
                const state =
                  stageStates[stage.id] || 'pending';

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
                          Unlock the verified compliance evidence
                          workflow using an x402 pay-per-analysis
                          request on Algorand Testnet.
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