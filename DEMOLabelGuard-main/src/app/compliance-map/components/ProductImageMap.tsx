'use client';

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Layers, Info, ImageOff, Video } from 'lucide-react';
import {
  type ProductAnalysis,
  type DeclarationStatus,
  type ImageId,
  imageLabelFor,
} from '@/lib/mockData';
import EvidenceOverlay, { type EvidenceBoxSpec } from './EvidenceOverlay';

interface Props {
  product: ProductAnalysis;
  selectedDeclarationId: string | null;
  hoveredDeclarationId: string | null;
  /** Which image (front, back, or an optional additional view) is shown. */
  activeSide: ImageId;
  onSelectDeclaration: (id: string | null) => void;
  onHoverDeclaration: (id: string | null) => void;
  onSetActiveSide: (side: ImageId) => void;
}

interface ImageView {
  id: ImageId;
  label: string;
  url: string;
  alt: string;
  /** Real timestamp (seconds into the source video), only set when this
   * view actually came from the video scan pipeline — never guessed. */
  videoTimestampSeconds?: number | null;
}

const STATUS_COLORS: Record<DeclarationStatus, { box: string; label: string; bg: string }> = {
  PASS: {
    box: 'border-pass',
    label: 'bg-pass text-white',
    bg: 'bg-pass/10',
  },
  REVIEW: {
    box: 'border-review',
    label: 'bg-review text-white',
    bg: 'bg-review/10',
  },
  FLAG: {
    box: 'border-flag',
    label: 'bg-flag text-white',
    bg: 'bg-flag/10',
  },
};

export default function ProductImageMap({
  product,
  selectedDeclarationId,
  hoveredDeclarationId,
  activeSide,
  onSelectDeclaration,
  onHoverDeclaration,
  onSetActiveSide,
}: Props) {
  const [showBoxes, setShowBoxes] = useState(true);
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const evidenceRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Dynamic list of image views — front is always present; back and any
  // additional views (side panels, top, bottom, close-ups) are optional.
  // Only views that actually exist on this product are ever shown.
  const views: ImageView[] = useMemo(() => {
    const list: ImageView[] = [
      {
        id: 'front',
        label: 'Front',
        url: product.imageUrl,
        alt: product.imageAlt,
        videoTimestampSeconds: product.frontVideoTimestampSeconds,
      },
    ];

    if (product.backImageUrl) {
      list.push({
        id: 'back',
        label: 'Back',
        url: product.backImageUrl,
        alt: product.backImageAlt || 'Back of package',
        videoTimestampSeconds: product.backVideoTimestampSeconds,
      });
    }

    (product.additionalImages || []).forEach((img) => {
      list.push({
        id: img.id,
        label: imageLabelFor(img.id),
        url: img.url,
        alt: img.alt,
        videoTimestampSeconds: img.videoTimestampSeconds,
      });
    });

    return list;
  }, [product]);

  const hasMultipleViews = views.length > 1;

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z + 0.2, 2.5)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z - 0.2, 0.6)), []);
  const handleReset = useCallback(() => setZoom(1), []);

  const registerRef = useCallback((id: string, node: HTMLButtonElement | null) => {
    evidenceRefs.current[id] = node;
  }, []);

  useEffect(() => {
    if (!selectedDeclarationId || !showBoxes) return;
    const target = evidenceRefs.current[selectedDeclarationId];
    const container = containerRef.current;
    if (!target || !container) return;

    const nextZoom = 2.15;
    setZoom(nextZoom);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const rect = target.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const dx = rect.left + rect.width / 2 - (containerRect.left + containerRect.width / 2);
        const dy = rect.top + rect.height / 2 - (containerRect.top + containerRect.height / 2);
        container.scrollBy({ left: dx, top: dy, behavior: 'smooth' });
      });
    });
  }, [selectedDeclarationId, showBoxes, activeSide]);

  // Declarations whose evidence (or, for legacy demo data, whose single
  // front-only boundingBox) belongs to the currently active side.
  const visibleDeclarations = useMemo(() => {
    return product.declarations.filter((decl) => {
      if (!hasMultipleViews) {
        // Legacy demo products only ever have one image (front).
        return true;
      }

      // Real uploads: only show boxes whose evidence was located on the
      // side currently being viewed. Declarations with no evidence (or
      // evidence on the other side) simply render no box on this side.
      return decl.evidence?.image === activeSide;
    });
  }, [product.declarations, hasMultipleViews, activeSide]);

  const selectedDeclaration =
    product.declarations.find((d) => d.id === selectedDeclarationId) || null;
  const selectedHasNoEvidenceOnThisSide =
    hasMultipleViews &&
    !!selectedDeclaration &&
    selectedDeclaration.evidence?.image !== activeSide &&
    !!selectedDeclaration.evidence;

  const boxes: EvidenceBoxSpec[] = visibleDeclarations.map((decl) => {
    const colors = STATUS_COLORS[decl.status];
    const isSelected = selectedDeclarationId === decl.id;
    const isHovered = hoveredDeclarationId === decl.id;
    const region = hasMultipleViews ? decl.evidence : { ...decl.boundingBox };

    return {
      id: decl.id,
      x: region?.x ?? 0,
      y: region?.y ?? 0,
      width: region?.width ?? 0,
      height: region?.height ?? 0,
      label: decl.field,
      confidencePct: decl.confidence,
      colorClass: colors.box,
      activeBgClass: colors.bg,
      labelClass: colors.label,
      isActive: isSelected || isHovered,
      isSelected,
    };
  });

  const activeView = views.find((v) => v.id === activeSide) || views[0];
  const currentImageUrl = activeView.url;
  const currentImageAlt = activeView.alt;

  const handleImageError = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    if (img.src.endsWith('/assets/images/no_image.png')) return;
    img.src = '/assets/images/no_image.png';
  }, []);

  return (
        <div id="compliance-map-image" className="card overflow-hidden scroll-mt-24">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-muted-foreground" />
          <span className="text-sm font-semibold text-navy">Compliance Map</span>
          <span className="text-xs text-muted-foreground">
            {product.declarations.length} declarations analyzed
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Legend */}
          <div className="hidden sm:flex items-center gap-3 mr-2">
            {(['PASS', 'REVIEW', 'FLAG'] as DeclarationStatus[]).map((s) => (
              <span key={`legend-${s}`} className="flex items-center gap-1 text-xs">
                <span className={`w-2.5 h-2.5 rounded-sm border-2 ${STATUS_COLORS[s].box}`} />
                <span className="text-muted-foreground">{s}</span>
              </span>
            ))}
          </div>

          {/* Toggle boxes */}
          <button
            onClick={() => setShowBoxes((v) => !v)}
            className={`focus-ring flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              showBoxes
                ? 'bg-accent/10 text-accent border border-accent/20'
                : 'bg-muted text-muted-foreground border border-border'
            }`}
          >
            <Layers size={12} />
            {showBoxes ? 'Boxes on' : 'Boxes off'}
          </button>

          {/* Zoom controls */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <button
              onClick={handleZoomOut}
              className="focus-ring p-1.5 hover:bg-muted transition-colors"
              aria-label="Zoom out"
            >
              <ZoomOut size={14} className="text-muted-foreground" />
            </button>
            <span className="px-2 text-xs font-tabular text-muted-foreground border-x border-border">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="focus-ring p-1.5 hover:bg-muted transition-colors"
              aria-label="Zoom in"
            >
              <ZoomIn size={14} className="text-muted-foreground" />
            </button>
            <button
              onClick={handleReset}
              className="focus-ring p-1.5 hover:bg-muted transition-colors border-l border-border"
              aria-label="Reset zoom"
            >
              <RotateCcw size={12} className="text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Image tabs — only shown for real uploads with more than one view.
          Dynamic: Front | Back | View 1 | View 2 ... — only views that
          actually exist on this product get a tab. */}
      {hasMultipleViews && (
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border flex-wrap">
          {views.map((view) => (
            <button
              key={`side-tab-${view.id}`}
              onClick={() => onSetActiveSide(view.id)}
              aria-pressed={activeSide === view.id}
              className={`focus-ring flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                activeSide === view.id
                  ? 'bg-accent text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
              title={
                typeof view.videoTimestampSeconds === 'number'
                  ? `Selected from a video frame at ${view.videoTimestampSeconds.toFixed(1)}s`
                  : undefined
              }
            >
              {view.label}
              {typeof view.videoTimestampSeconds === 'number' && (
                <span className="flex items-center gap-0.5 opacity-80">
                  <Video size={10} />
                  {view.videoTimestampSeconds.toFixed(1)}s
                </span>
              )}
            </button>
          ))}

          {selectedHasNoEvidenceOnThisSide && (
            <span className="text-xs text-muted-foreground/70 italic ml-2">
              Selected finding&apos;s evidence is on another view.
            </span>
          )}
        </div>
      )}

      {/* Image area */}
      <div
        ref={containerRef}
        className="relative bg-slate-900 overflow-auto"
        style={{ minHeight: '480px', maxHeight: '640px' }}
      >
        <div
          className="relative mx-auto"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top center',
            transition: 'transform 0.2s ease',
          }}
        >
          {/* Product image */}
          <div
            className="relative w-full"
            style={{ aspectRatio: '1/1', maxWidth: '600px', margin: '0 auto' }}
          >
            <EvidenceOverlay
              src={currentImageUrl}
              alt={currentImageAlt}
              boxes={boxes}
              showBoxes={showBoxes}
              registerRef={registerRef}
              onSelectBox={onSelectDeclaration}
              onHoverBox={onHoverDeclaration}
              onImageError={handleImageError}
            />
          </div>
        </div>

        {/* Selected declaration with no locatable evidence at all */}
        {selectedDeclaration && !selectedDeclaration.evidence && hasMultipleViews && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-navy/80 text-white text-xs font-medium pointer-events-none">
            <ImageOff size={11} />
            Evidence location unavailable for {selectedDeclaration.field}
          </div>
        )}

        {/* Click hint */}
        {!selectedDeclarationId && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-navy/70 text-white text-xs font-medium pointer-events-none">
            <Info size={11} />
            Click any highlighted region to inspect
          </div>
        )}
      </div>
    </div>
  );
}
