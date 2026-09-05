'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Camera, Image as ImageIcon, X, ScanLine, AlertCircle, CheckCircle2 } from 'lucide-react';
import AppImage from '@/components/ui/AppImage';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';

// Dynamically import CameraCapture (client-only, no SSR) to avoid hydration issues
const CameraCapture = dynamic(() => import('./CameraCapture'), { ssr: false });

const PRODUCT_CATEGORIES = [
  { id: 'food', label: 'Food & Beverage', emoji: '🌾' },
  { id: 'cosmetics', label: 'Cosmetics', emoji: '💄' },
  { id: 'household', label: 'Household', emoji: '🧴' },
  { id: 'other', label: 'Other', emoji: '📦' },
];

export default function UploadZoneSection() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('food');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB.');
      return;
    }
    setUploadedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    toast.success('Image loaded. Ready to analyze.');
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const clearUpload = useCallback(() => {
    setUploadedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [previewUrl]);

  const handleAnalyze = useCallback(async () => {
    if (!uploadedFile) {
      toast.error('Please upload a product image first.');
      return;
    }

    setIsAnalyzing(true);

    // Keep arbitrary uploads honest until the real OCR/vision backend is connected.
    // We pass a compressed preview to the analysis screen instead of mapping it to a
    // fabricated product result.
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Unable to read image'));
        reader.readAsDataURL(uploadedFile);
      });

      sessionStorage.setItem(
        'labelguard:pending-upload',
        JSON.stringify({
          name: uploadedFile.name,
          category: selectedCategory,
          imageDataUrl: dataUrl,
          capturedAt: new Date().toISOString(),
        })
      );

      router.push('/analysis?mode=upload');
    } catch {
      toast.error('Could not prepare the image for analysis. Please try again.');
      setIsAnalyzing(false);
    }
  }, [uploadedFile, router, selectedCategory]);

  const handleCameraCapture = useCallback(
    (file: File) => {
      setShowCamera(false);
      handleFile(file);
    },
    [handleFile]
  );

  return (
    <>
      {/* Camera modal — rendered outside the card, client-only */}
      {showCamera && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      )}

      <div className="card p-6 h-full flex flex-col gap-5">
        {/* Header */}
        <div>
          <h2 className="text-lg font-bold text-navy">Scan a Product Label</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Upload a clear photo of the packaged product label
          </p>
        </div>

        {/* Upload zone */}
        {!previewUrl ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 min-h-[220px] ${
              isDragging
                ? 'border-accent bg-accent/5 scale-[1.01]'
                : 'border-border hover:border-accent/50 hover:bg-muted/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileInput}
              className="hidden"
              aria-label="Upload product image"
            />

            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200 ${
                isDragging ? 'bg-accent text-white' : 'bg-muted text-muted-foreground'
              }`}
            >
              <Upload size={24} />
            </div>

            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {isDragging ? 'Drop to upload' : 'Drag & drop your image here'}
              </p>
              <p className="text-xs text-muted-foreground">
                or click to browse — JPG, PNG, WebP up to 10MB
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                <ImageIcon size={12} />
                Browse files
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCamera(true);
                }}
              >
                <Camera size={12} />
                Use camera
              </button>
            </div>

            <p className="text-xs text-muted-foreground/70 px-4 text-center">
              For best results, ensure the full label is visible and well-lit
            </p>
          </div>
        ) : (
          /* Image preview */
          <div className="relative rounded-xl overflow-hidden border border-border bg-muted/30 min-h-[220px]">
            <AppImage
              src={previewUrl}
              alt="Uploaded product label preview for compliance analysis"
              fill
              className="object-contain"
              unoptimized
            />
            <button
              onClick={clearUpload}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-navy/80 text-white flex items-center justify-center hover:bg-navy transition-all"
              aria-label="Remove uploaded image"
            >
              <X size={14} />
            </button>
            <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-navy/80 text-white text-xs font-medium">
              <CheckCircle2 size={12} className="text-pass" />
              {uploadedFile?.name}
            </div>
          </div>
        )}

        {/* Category selector */}
        <div>
          <label className="section-label mb-2 block">Product Category</label>
          <div className="grid grid-cols-2 gap-2">
            {PRODUCT_CATEGORIES.map((cat) => (
              <button
                key={`cat-${cat.id}`}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all duration-150 ${
                  selectedCategory === cat.id
                    ? 'border-accent bg-accent/10 text-accent' :'border-border bg-card text-muted-foreground hover:border-accent/40 hover:text-foreground'
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

        {/* Disclaimer */}
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
          <AlertCircle size={14} className="text-review mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-800 leading-relaxed">
            AI-assisted screening only. Manual verification recommended for all findings.
            This tool does not provide legal certification.
          </p>
        </div>

        {/* Analyze CTA */}
        <button
          onClick={handleAnalyze}
          disabled={!uploadedFile || isAnalyzing}
          className="btn-primary w-full py-3.5 text-base font-bold rounded-xl mt-auto disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isAnalyzing ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Starting analysis...
            </>
          ) : (
            <>
              <ScanLine size={18} />
              Analyze Label
            </>
          )}
        </button>
      </div>
    </>
  );
}
