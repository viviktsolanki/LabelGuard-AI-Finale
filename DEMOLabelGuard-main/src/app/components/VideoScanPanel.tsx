'use client';

/**
 * VIDEO / 360° SCAN panel.
 *
 * Owns everything about turning a video into reviewed still frames:
 * upload, recording (via VideoCapture.tsx), two-pass extraction (via
 * videoFrames.ts), and a review screen where the user can drop frames
 * before they're handed off.
 *
 * IMPORTANT: this component does NOT touch sessionStorage, does NOT call
 * /api/analyze, and does NOT know about front/back/additional slot
 * semantics beyond "first frame, second frame, rest." Once the user
 * accepts frames, `onFramesAccepted` hands plain `File[]` back to
 * UploadZoneSection, which maps them into the exact same state
 * (frontFile/backFile/additionalSlots) a manual photo upload would use.
 * From that point on this component is out of the picture entirely — no
 * parallel "video analysis" pipeline exists.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Upload, Video, X, AlertCircle, RotateCcw, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  extractFramesFromVideo,
  MAX_VIDEO_DURATION_SECONDS,
  MAX_VIDEO_FILE_SIZE_BYTES,
  VideoProcessingError,
  type ExtractedFrame,
  type FrameExtractionProgress,
} from '@/lib/videoFrames';

const VideoCapture = dynamic(() => import('./VideoCapture'), { ssr: false });

interface VideoScanPanelProps {
  /** Real capacity of the existing image pipeline (front + back +
   * however many additional slots exist) — passed in rather than assumed,
   * so this panel can never extract more frames than can actually be
   * used. */
  maxFrames: number;
  /** Minimum frames required before the user can proceed — the existing
   * pipeline requires front + back, so this should be 2. */
  minRequiredFrames: number;
  /** Accepted frames, each paired with the real timestamp (seconds into
   * the source video) it was extracted from — so downstream evidence UI
   * can truthfully label a finding as coming from a video frame instead
   * of inventing/guessing that context later. */
  onFramesAccepted: (frames: { file: File; timestampSeconds: number }[]) => void;
}

type PanelStage = 'choose' | 'extracting' | 'review' | 'extraction-error';

const STAGE_LABEL: Record<FrameExtractionProgress['stage'], string> = {
  reading: 'Reading video…',
  sampling: 'Finding clear frames…',
  selecting: 'Selecting best views…',
  extracting: 'Preparing analysis…',
};

export default function VideoScanPanel({
  maxFrames,
  minRequiredFrames,
  onFramesAccepted,
}: VideoScanPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<PanelStage>('choose');
  const [showRecorder, setShowRecorder] = useState(false);
  const [progress, setProgress] = useState<FrameExtractionProgress>({
    stage: 'reading',
    fraction: 0,
  });
  const [frames, setFrames] = useState<ExtractedFrame[]>([]);
  const [qualityWarning, setQualityWarning] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [lastVideoFile, setLastVideoFile] = useState<File | null>(null);

  const revokeFramePreviews = useCallback((framesToRevoke: ExtractedFrame[]) => {
    framesToRevoke.forEach((f) => URL.revokeObjectURL(f.previewUrl));
  }, []);

  // MEMORY FIX: each extracted frame creates its own preview blob URL (see
  // extractFramesFromVideo in videoFrames.ts). Every path that stopped
  // showing a given set of frames already revoked them (handleRetry,
  // handleRemoveFrame) EXCEPT accepting the frames and simply switching
  // back to Photo Scan mode (UploadZoneSection unmounts this panel once
  // `onFramesAccepted` runs) or navigating away mid-review — in both
  // cases `frames` was discarded with its blob URLs still allocated,
  // leaking one blob per extracted frame for the rest of the page's
  // lifetime. `framesRef` lets the unmount cleanup below see the latest
  // frames without re-subscribing the effect on every state change.
  const framesRef = useRef<ExtractedFrame[]>(frames);
  framesRef.current = frames;

  useEffect(() => {
    return () => {
      framesRef.current.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    };
  }, []);

  const runExtraction = useCallback(
    async (videoFile: File) => {
      setLastVideoFile(videoFile);
      setStage('extracting');
      setProgress({ stage: 'reading', fraction: 0 });
      setErrorMessage('');
      setQualityWarning(null);

      try {
        const { frames: extracted, qualityWarning: warning } = await extractFramesFromVideo(
          videoFile,
          maxFrames,
          setProgress
        );
        setFrames(extracted);
        setQualityWarning(warning);
        setStage('review');
      } catch (err) {
        const message =
          err instanceof VideoProcessingError
            ? err.message
            : 'Something went wrong while extracting frames from your video. Please try again.';
        setErrorMessage(message);
        setStage('extraction-error');
      }
    },
    [maxFrames]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;

      if (file.size > MAX_VIDEO_FILE_SIZE_BYTES) {
        toast.error(
          `This video file is too large. Please keep it under ${Math.round(
            MAX_VIDEO_FILE_SIZE_BYTES / (1024 * 1024)
          )}MB.`
        );
        return;
      }

      runExtraction(file);
    },
    [runExtraction]
  );

  const handleRecorded = useCallback(
    (file: File) => {
      setShowRecorder(false);
      runExtraction(file);
    },
    [runExtraction]
  );

  const handleRemoveFrame = useCallback((id: string) => {
    setFrames((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const handleRetry = useCallback(() => {
    revokeFramePreviews(frames);
    setFrames([]);
    setQualityWarning(null);
    setStage('choose');
    setErrorMessage('');
  }, [frames, revokeFramePreviews]);

  const handleAccept = useCallback(() => {
    if (frames.length < minRequiredFrames) {
      toast.error(
        `LabelGuard needs at least ${minRequiredFrames} clear views (front and back). Please keep more frames or record a longer, slower rotation.`
      );
      return;
    }
    onFramesAccepted(frames.map((f) => ({ file: f.file, timestampSeconds: f.timestampSeconds })));
    // Revoking a blob URL doesn't affect the underlying File/Blob data
    // (UploadZoneSection creates its own fresh preview URLs from `f.file`
    // above), so these review-stage previews are safe to release now
    // rather than leaking until the unmount cleanup above runs.
    revokeFramePreviews(frames);
    setFrames([]);
  }, [frames, minRequiredFrames, onFramesAccepted, revokeFramePreviews]);

  return (
    <div className="space-y-4">
      {showRecorder && (
        <VideoCapture onCapture={handleRecorded} onClose={() => setShowRecorder(false)} />
      )}

      {stage === 'choose' && (
        <div className="rounded-xl border-2 border-dashed border-border p-6 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center">
            <Video size={26} className="text-accent" />
          </div>

          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              Slowly rotate the product in front of the camera
            </p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Record or upload a short video (up to {MAX_VIDEO_DURATION_SECONDS}s). LabelGuard will
              pick out the clearest, most useful frames for analysis.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileInput}
              className="hidden"
              aria-label="Upload product video"
            />

            <button
              type="button"
              onClick={() => setShowRecorder(true)}
              className="btn-primary px-5 py-2.5 text-sm"
            >
              <Video size={15} />
              Record Video
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-card border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            >
              <Upload size={15} />
              Upload Video
            </button>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Max {MAX_VIDEO_DURATION_SECONDS}s ·{' '}
            {Math.round(MAX_VIDEO_FILE_SIZE_BYTES / (1024 * 1024))}MB max file size
          </p>
        </div>
      )}

      {stage === 'extracting' && (
        <div className="rounded-xl border border-border p-6 flex flex-col items-center gap-4 text-center min-h-[220px] justify-center">
          <Loader2 size={28} className="text-accent animate-spin" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{STAGE_LABEL[progress.stage]}</p>
            <p className="text-xs text-muted-foreground">
              This runs entirely on your device — the video itself is never uploaded.
            </p>
          </div>
          <div className="w-full max-w-xs h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-200"
              style={{ width: `${Math.round(progress.fraction * 100)}%` }}
            />
          </div>
        </div>
      )}

      {stage === 'extraction-error' && (
        <div className="rounded-xl border border-border p-6 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-flag/10 flex items-center justify-center">
            <AlertCircle size={26} className="text-flag" />
          </div>
          <p className="text-sm text-foreground max-w-sm">{errorMessage}</p>
          <div className="flex gap-3">
            <button
              onClick={handleRetry}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            >
              <RotateCcw size={14} />
              Try a Different Video
            </button>
            {lastVideoFile && (
              <button
                onClick={() => runExtraction(lastVideoFile)}
                className="btn-primary px-4 py-2 text-sm"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {stage === 'review' && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200">
            <AlertCircle size={14} className="text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-800 leading-relaxed">
              These are the views LabelGuard selected from your product video. Remove any that look
              blurry or unhelpful — the rest will be used for AI analysis, the same as manually
              uploaded photos.
            </p>
          </div>

          {qualityWarning && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <AlertCircle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800 leading-relaxed">{qualityWarning}</p>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {frames.map((frame, index) => (
              <div
                key={frame.id}
                className="relative rounded-xl overflow-hidden border border-border bg-muted/30 h-[120px]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={frame.previewUrl}
                  alt={`Extracted product video frame ${index + 1}`}
                  className="w-full h-full object-contain"
                />

                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-navy/80 text-white text-[10px] font-semibold">
                  {index === 0 ? 'Front' : index === 1 ? 'Back' : `View ${index - 1}`}
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveFrame(frame.id)}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-navy/80 text-white flex items-center justify-center hover:bg-navy transition-all"
                  aria-label={`Remove frame ${index + 1}`}
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>

          {frames.length < minRequiredFrames && (
            <p className="text-xs text-flag">
              At least {minRequiredFrames} views are needed (front and back). Remove fewer frames,
              or retry with a slower, longer rotation.
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleRetry}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            >
              <RotateCcw size={14} />
              Use a Different Video
            </button>
            <button
              onClick={handleAccept}
              disabled={frames.length < minRequiredFrames}
              className="flex-1 btn-primary py-2.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Use These Frames
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
