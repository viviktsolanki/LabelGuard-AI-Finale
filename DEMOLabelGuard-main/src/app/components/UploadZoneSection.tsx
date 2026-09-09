'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload,
  Camera,
  Image as ImageIcon,
  X,
  ScanLine,
  AlertCircle,
  CheckCircle2,
  Plus,
  Video,
  Images,
} from 'lucide-react';
import AppImage from '@/components/ui/AppImage';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import { ADDITIONAL_IMAGE_IDS, imageLabelFor, type AdditionalImageId } from '@/lib/mockData';
import { fileToOptimizedDataUrl } from '@/lib/imagePrep';

const CameraCapture = dynamic(() => import('./CameraCapture'), { ssr: false });
const VideoScanPanel = dynamic(() => import('./VideoScanPanel'), { ssr: false });

/** Two ways to get product images in. Video is an ADDITIONAL scan method —
 * the photo path below (front/back/additional uploads, camera capture,
 * validation, Analyze button) is completely unchanged and still works
 * exactly as before when this is 'photo'. */
type ScanMode = 'photo' | 'video';

/** One optional additional view slot (side panel, top, bottom, close-up).
 * `id` is a stable internal id (additional-1..4) — the UI only ever shows
 * the friendly "View N" label derived from it. */
interface AdditionalSlot {
  id: AdditionalImageId;
  file: File | null;
  previewUrl: string | null;
  /** Timestamp (seconds into the source video) this slot's image was
   * extracted from, if it came from the video scan pipeline rather than a
   * manual upload/camera capture. Null for a manually provided image. */
  videoTimestampSeconds: number | null;
}

const PRODUCT_CATEGORIES = [
  { id: 'food', label: 'Food & Beverage', emoji: '🌾' },
  { id: 'cosmetics', label: 'Cosmetics', emoji: '💄' },
  { id: 'household', label: 'Household', emoji: '🧴' },
  { id: 'other', label: 'Other', emoji: '📦' },
];

export default function UploadZoneSection() {
  const router = useRouter();

  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState<'front' | 'back' | null>(null);
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [frontPreviewUrl, setFrontPreviewUrl] = useState<string | null>(null);
  const [backPreviewUrl, setBackPreviewUrl] = useState<string | null>(null);
  // Timestamp (seconds into the source video) for front/back, only set
  // when that image came from the video scan pipeline — null for a
  // manual upload/camera capture. Used purely to give the evidence UI
  // truthful "from video frame" context later; never affects analysis.
  const [frontVideoTimestamp, setFrontVideoTimestamp] = useState<number | null>(null);
  const [backVideoTimestamp, setBackVideoTimestamp] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('food');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showCamera, setShowCamera] = useState<'front' | 'back' | null>(null);
  const [scanMode, setScanMode] = useState<ScanMode>('photo');

  // Optional additional views (side panels, top, bottom, close-ups) —
  // never required. Each slot gets the next unused additional-N id.
  const [additionalSlots, setAdditionalSlots] = useState<AdditionalSlot[]>([]);
  const [additionalCameraSlotId, setAdditionalCameraSlotId] = useState<AdditionalImageId | null>(
    null
  );
  const additionalInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleFile = useCallback(
    (file: File, side: 'front' | 'back', videoTimestampSeconds: number | null = null) => {
      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file (JPG, PNG, WebP).');
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.error('Image must be under 10MB.');
        return;
      }

      const url = URL.createObjectURL(file);

      if (side === 'front') {
        if (frontPreviewUrl) {
          URL.revokeObjectURL(frontPreviewUrl);
        }

        setFrontFile(file);
        setFrontPreviewUrl(url);
        setFrontVideoTimestamp(videoTimestampSeconds);
        toast.success('Front image loaded.');
      } else {
        if (backPreviewUrl) {
          URL.revokeObjectURL(backPreviewUrl);
        }

        setBackFile(file);
        setBackPreviewUrl(url);
        setBackVideoTimestamp(videoTimestampSeconds);
        toast.success('Back image loaded.');
      }
    },
    [frontPreviewUrl, backPreviewUrl]
  );

  const handleDragOver = useCallback((e: React.DragEvent, side: 'front' | 'back') => {
    e.preventDefault();
    setIsDragging(side);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, side: 'front' | 'back') => {
      e.preventDefault();
      setIsDragging(null);

      const file = e.dataTransfer.files[0];

      if (file) {
        handleFile(file, side);
      }
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
      const file = e.target.files?.[0];

      if (file) {
        handleFile(file, side);
      }
    },
    [handleFile]
  );

  const clearUpload = useCallback(
    (side: 'front' | 'back') => {
      if (side === 'front') {
        if (frontPreviewUrl) {
          URL.revokeObjectURL(frontPreviewUrl);
        }

        setFrontFile(null);
        setFrontPreviewUrl(null);
        setFrontVideoTimestamp(null);

        if (frontInputRef.current) {
          frontInputRef.current.value = '';
        }
      } else {
        if (backPreviewUrl) {
          URL.revokeObjectURL(backPreviewUrl);
        }

        setBackFile(null);
        setBackPreviewUrl(null);
        setBackVideoTimestamp(null);

        if (backInputRef.current) {
          backInputRef.current.value = '';
        }
      }
    },
    [frontPreviewUrl, backPreviewUrl]
  );

  // Downscales + re-encodes before producing a data URL (see imagePrep.ts)
  // so a realistic multi-photo phone scan reliably fits in
  // sessionStorage/localStorage instead of silently blowing the browser's
  // per-origin storage quota.
  const fileToDataUrl = useCallback((file: File) => {
    return fileToOptimizedDataUrl(file);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!frontFile || !backFile) {
      toast.error('Please upload both the front and back images.');
      return;
    }

    setIsAnalyzing(true);

    try {
      const filledAdditionalSlots = additionalSlots.filter(
        (slot): slot is AdditionalSlot & { file: File } => Boolean(slot.file)
      );

      const [frontDataUrl, backDataUrl, additionalDataUrls] = await Promise.all([
        fileToDataUrl(frontFile),
        fileToDataUrl(backFile),
        Promise.all(
          filledAdditionalSlots.map(async (slot) => ({
            id: slot.id,
            dataUrl: await fileToDataUrl(slot.file),
            timestampSeconds: slot.videoTimestampSeconds,
          }))
        ),
      ]);

      sessionStorage.setItem(
        'labelguard:pending-upload',
        JSON.stringify({
          name: frontFile.name,
          category: selectedCategory,
          frontImageDataUrl: frontDataUrl,
          backImageDataUrl: backDataUrl,
          frontVideoTimestampSeconds: frontVideoTimestamp,
          backVideoTimestampSeconds: backVideoTimestamp,
          additionalImages: additionalDataUrls,
          capturedAt: new Date().toISOString(),
        })
      );

      router.push('/analysis?mode=upload');
    } catch (error) {
      console.error('Image preparation error:', error);

      toast.error('Could not prepare the images for analysis. Please try again.');

      setIsAnalyzing(false);
    }
  }, [
    frontFile,
    backFile,
    frontVideoTimestamp,
    backVideoTimestamp,
    additionalSlots,
    selectedCategory,
    fileToDataUrl,
    router,
  ]);

  const handleCameraCapture = useCallback(
    (file: File) => {
      const side = showCamera;

      setShowCamera(null);

      if (side) {
        handleFile(file, side);
      }
    },
    [showCamera, handleFile]
  );

  // Video -> photo pipeline handoff. Frames arrive as plain Files, already
  // full-resolution JPEGs (see videoFrames.ts) — from here they are treated
  // EXACTLY like manually uploaded/captured photos. There is no separate
  // video state, video product type, or video analysis path: front/back
  // reuse the same handleFile() as manual upload, and any remaining frames
  // become additional-view slots the same way handleAdditionalFile() does.
  // Once this runs, the video system has nothing left to do — we switch
  // back to 'photo' mode so the user reviews/adjusts using the exact same
  // front/back/additional cards and Analyze button as the manual flow.
  const handleVideoFramesAccepted = useCallback(
    (frames: { file: File; timestampSeconds: number }[]) => {
      const [frontFrame, backFrame, ...extraFrames] = frames;

      if (frontFrame) handleFile(frontFrame.file, 'front', frontFrame.timestampSeconds);
      if (backFrame) handleFile(backFrame.file, 'back', backFrame.timestampSeconds);

      setAdditionalSlots((prev) => {
        prev.forEach((slot) => {
          if (slot.previewUrl) URL.revokeObjectURL(slot.previewUrl);
        });

        return extraFrames.slice(0, ADDITIONAL_IMAGE_IDS.length).map((frame, index) => ({
          id: ADDITIONAL_IMAGE_IDS[index],
          file: frame.file,
          previewUrl: URL.createObjectURL(frame.file),
          videoTimestampSeconds: frame.timestampSeconds,
        }));
      });

      toast.success('Video frames loaded — review them below, then analyze.');
      setScanMode('photo');
    },
    [handleFile]
  );

  const handleAddAdditionalSlot = useCallback(() => {
    setAdditionalSlots((prev) => {
      if (prev.length >= ADDITIONAL_IMAGE_IDS.length) return prev;

      const usedIds = new Set(prev.map((slot) => slot.id));
      const nextId = ADDITIONAL_IMAGE_IDS.find((id) => !usedIds.has(id));
      if (!nextId) return prev;

      return [...prev, { id: nextId, file: null, previewUrl: null, videoTimestampSeconds: null }];
    });
  }, []);

  const handleRemoveAdditionalSlot = useCallback((id: AdditionalImageId) => {
    setAdditionalSlots((prev) => {
      const slot = prev.find((s) => s.id === id);
      if (slot?.previewUrl) {
        URL.revokeObjectURL(slot.previewUrl);
      }
      return prev.filter((s) => s.id !== id);
    });
  }, []);

  const handleAdditionalFile = useCallback((id: AdditionalImageId, file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (JPG, PNG, WebP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB.');
      return;
    }

    const url = URL.createObjectURL(file);

    setAdditionalSlots((prev) =>
      prev.map((slot) => {
        if (slot.id !== id) return slot;
        if (slot.previewUrl) URL.revokeObjectURL(slot.previewUrl);
        // Manual replacement of a slot's image is never a video frame,
        // even if the slot previously held one.
        return { ...slot, file, previewUrl: url, videoTimestampSeconds: null };
      })
    );

    toast.success(`${imageLabelFor(id)} added.`);
  }, []);

  const handleAdditionalFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, id: AdditionalImageId) => {
      const file = e.target.files?.[0];
      if (file) handleAdditionalFile(id, file);
    },
    [handleAdditionalFile]
  );

  const handleAdditionalCameraCapture = useCallback(
    (file: File) => {
      const slotId = additionalCameraSlotId;
      setAdditionalCameraSlotId(null);
      if (slotId) handleAdditionalFile(slotId, file);
    },
    [additionalCameraSlotId, handleAdditionalFile]
  );

  const renderUploadCard = (side: 'front' | 'back') => {
    const file = side === 'front' ? frontFile : backFile;
    const previewUrl = side === 'front' ? frontPreviewUrl : backPreviewUrl;
    const inputRef = side === 'front' ? frontInputRef : backInputRef;

    const label = side === 'front' ? 'Front of Package' : 'Back of Package';

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="section-label">{label}</label>

          {file && (
            <span className="text-xs text-pass font-medium flex items-center gap-1">
              <CheckCircle2 size={12} />
              Added
            </span>
          )}
        </div>

        {!previewUrl ? (
          <div
            role="button"
            tabIndex={0}
            aria-label={`Upload ${label}. Drag and drop, or press Enter to browse.`}
            onDragOver={(e) => handleDragOver(e, side)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, side)}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            className={`focus-ring relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 min-h-[190px] ${
              isDragging === side
                ? 'border-accent bg-accent/5 scale-[1.01]'
                : 'border-border hover:border-accent/50 hover:bg-muted/50'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleFileInput(e, side)}
              className="hidden"
              aria-label={`Upload ${side} product image`}
            />

            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                isDragging === side ? 'bg-accent text-white' : 'bg-muted text-muted-foreground'
              }`}
            >
              <Upload size={21} />
            </div>

            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {isDragging === side ? 'Drop to upload' : `Upload ${side} image`}
              </p>

              <p className="text-xs text-muted-foreground">JPG, PNG, WebP up to 10MB</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  inputRef.current?.click();
                }}
              >
                <ImageIcon size={12} />
                Browse
              </button>

              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCamera(side);
                }}
              >
                <Camera size={12} />
                Camera
              </button>
            </div>
          </div>
        ) : (
          <div className="relative rounded-xl overflow-hidden border border-border bg-muted/30 h-[190px]">
            <AppImage
              src={previewUrl}
              alt={`${side} product label preview`}
              fill
              className="object-contain"
              unoptimized
            />

            <button
              type="button"
              onClick={() => clearUpload(side)}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-navy/80 text-white flex items-center justify-center hover:bg-navy transition-all"
              aria-label={`Remove ${side} image`}
            >
              <X size={14} />
            </button>

            <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-navy/80 text-white text-xs font-medium truncate">
              <CheckCircle2 size={12} className="text-pass flex-shrink-0" />
              <span className="truncate">{file?.name}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAdditionalSlotCard = (slot: AdditionalSlot) => {
    const label = imageLabelFor(slot.id);
    const inputRef = (node: HTMLInputElement | null) => {
      additionalInputRefs.current[slot.id] = node;
    };

    return (
      <div key={`additional-slot-${slot.id}`} className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="section-label">{label}</label>

          {slot.file && (
            <span className="text-xs text-pass font-medium flex items-center gap-1">
              <CheckCircle2 size={12} />
              Added
            </span>
          )}
        </div>

        {!slot.previewUrl ? (
          <div className="relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border hover:border-accent/50 hover:bg-muted/50 cursor-pointer transition-all duration-200 min-h-[120px]">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleAdditionalFileInput(e, slot.id)}
              className="hidden"
              aria-label={`Upload ${label} product image`}
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                onClick={() => additionalInputRefs.current[slot.id]?.click()}
              >
                <ImageIcon size={12} />
                Browse
              </button>

              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                onClick={() => setAdditionalCameraSlotId(slot.id)}
              >
                <Camera size={12} />
                Camera
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleRemoveAdditionalSlot(slot.id)}
              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center hover:bg-navy/10 hover:text-navy transition-all"
              aria-label={`Remove ${label} slot`}
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <div className="relative rounded-xl overflow-hidden border border-border bg-muted/30 h-[120px]">
            <AppImage
              src={slot.previewUrl}
              alt={`${label} product label preview`}
              fill
              className="object-contain"
              unoptimized
            />

            <button
              type="button"
              onClick={() => handleRemoveAdditionalSlot(slot.id)}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-navy/80 text-white flex items-center justify-center hover:bg-navy transition-all"
              aria-label={`Remove ${label} image`}
            >
              <X size={14} />
            </button>

            <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-navy/80 text-white text-xs font-medium truncate">
              <CheckCircle2 size={12} className="text-pass flex-shrink-0" />
              <span className="truncate">{slot.file?.name}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {showCamera && (
        <CameraCapture onCapture={handleCameraCapture} onClose={() => setShowCamera(null)} />
      )}

      {additionalCameraSlotId && (
        <CameraCapture
          onCapture={handleAdditionalCameraCapture}
          onClose={() => setAdditionalCameraSlotId(null)}
        />
      )}

      <div className="card p-6 h-full flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-bold text-navy">Scan a Product Label</h2>

          <p className="text-sm text-muted-foreground mt-0.5">
            {scanMode === 'photo'
              ? 'Upload both sides of the packaged product label'
              : 'Rotate the product slowly to capture every side'}
          </p>
        </div>

        {/* Scan mode toggle. Video is an ADDITIONAL method — switching here
            never discards work already done in the other mode; it only
            changes which panel is visible. */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-muted">
          <button
            type="button"
            onClick={() => setScanMode('photo')}
            className={`focus-ring flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              scanMode === 'photo'
                ? 'bg-card text-navy shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Images size={14} />
            Photo Scan
          </button>
          <button
            type="button"
            onClick={() => setScanMode('video')}
            className={`focus-ring flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              scanMode === 'video'
                ? 'bg-card text-navy shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Video size={14} />
            Video / 360° Scan
          </button>
        </div>

        {scanMode === 'video' && (
          <VideoScanPanel
            maxFrames={2 + ADDITIONAL_IMAGE_IDS.length}
            minRequiredFrames={2}
            onFramesAccepted={handleVideoFramesAccepted}
          />
        )}

        {scanMode === 'photo' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderUploadCard('front')}
              {renderUploadCard('back')}
            </div>

            <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200">
              <AlertCircle size={14} className="text-blue-600 mt-0.5 flex-shrink-0" />

              <p className="text-xs text-blue-800 leading-relaxed">
                Upload the front and back of the same product. LabelGuard AI combines both images so
                declarations on either side can be analyzed together.
              </p>
            </div>

            {/* Additional views — optional. Side panels, top, bottom, or
            close-ups that may carry declarations not visible on the
            front/back (batch number, license number, MRP, warnings). */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="section-label">Additional Label Views (Optional)</label>
              </div>

              <p className="text-xs text-muted-foreground">
                Capture side panels or close-ups to improve label coverage.
              </p>

              {additionalSlots.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {additionalSlots.map((slot) => renderAdditionalSlotCard(slot))}
                </div>
              )}

              {additionalSlots.length < ADDITIONAL_IMAGE_IDS.length && (
                <button
                  type="button"
                  onClick={handleAddAdditionalSlot}
                  className="focus-ring flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card border border-dashed border-border text-xs font-semibold text-muted-foreground hover:text-accent hover:border-accent/50 transition-all"
                >
                  <Plus size={13} />
                  Add another view
                </button>
              )}
            </div>
          </>
        )}

        <div>
          <label className="section-label mb-2 block">Product Category</label>

          <div className="grid grid-cols-2 gap-2">
            {PRODUCT_CATEGORIES.map((cat) => (
              <button
                key={`cat-${cat.id}`}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`focus-ring flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all duration-150 ${
                  selectedCategory === cat.id
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border bg-card text-muted-foreground hover:border-accent/40 hover:text-foreground'
                }`}
              >
                <span className="text-base">{cat.emoji}</span>
                <span className="text-xs">{cat.label}</span>

                {selectedCategory === cat.id && (
                  <CheckCircle2 size={12} className="ml-auto text-accent" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
          <AlertCircle size={14} className="text-review mt-0.5 flex-shrink-0" />

          <p className="text-xs text-amber-800 leading-relaxed">
            AI-assisted screening only. Manual verification recommended for all findings. This tool
            does not provide legal certification.
          </p>
        </div>

        {scanMode === 'photo' && (
          <button
            onClick={handleAnalyze}
            disabled={!frontFile || !backFile || isAnalyzing}
            className="focus-ring btn-primary w-full py-3.5 text-base font-bold rounded-xl mt-auto disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isAnalyzing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Starting analysis...
              </>
            ) : (
              <>
                <ScanLine size={18} />
                Analyze Both Sides
              </>
            )}
          </button>
        )}
      </div>
    </>
  );
}
