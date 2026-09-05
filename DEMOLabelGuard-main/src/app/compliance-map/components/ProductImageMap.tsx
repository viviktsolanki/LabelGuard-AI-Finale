'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Layers, Info } from 'lucide-react';
import { type ProductAnalysis, type Declaration, type DeclarationStatus } from '@/lib/mockData';

interface Props {
  product: ProductAnalysis;
  selectedDeclarationId: string | null;
  hoveredDeclarationId: string | null;
  onSelectDeclaration: (id: string | null) => void;
  onHoverDeclaration: (id: string | null) => void;
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
  onSelectDeclaration,
  onHoverDeclaration,
}: Props) {
  const [showBoxes, setShowBoxes] = useState(true);
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const evidenceRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z + 0.2, 2.5)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z - 0.2, 0.6)), []);
  const handleReset = useCallback(() => setZoom(1), []);

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
  }, [selectedDeclarationId, showBoxes]);

  return (
    <div className="card overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
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
                <span
                  className={`w-2.5 h-2.5 rounded-sm border-2 ${STATUS_COLORS[s].box}`}
                />
                <span className="text-muted-foreground">{s}</span>
              </span>
            ))}
          </div>

          {/* Toggle boxes */}
          <button
            onClick={() => setShowBoxes((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              showBoxes
                ? 'bg-accent/10 text-accent border border-accent/20' :'bg-muted text-muted-foreground border border-border'
            }`}
          >
            <Layers size={12} />
            {showBoxes ? 'Boxes on' : 'Boxes off'}
          </button>

          {/* Zoom controls */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <button
              onClick={handleZoomOut}
              className="p-1.5 hover:bg-muted transition-colors"
              aria-label="Zoom out"
            >
              <ZoomOut size={14} className="text-muted-foreground" />
            </button>
            <span className="px-2 text-xs font-tabular text-muted-foreground border-x border-border">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-1.5 hover:bg-muted transition-colors"
              aria-label="Zoom in"
            >
              <ZoomIn size={14} className="text-muted-foreground" />
            </button>
            <button
              onClick={handleReset}
              className="p-1.5 hover:bg-muted transition-colors border-l border-border"
              aria-label="Reset zoom"
            >
              <RotateCcw size={12} className="text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

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
          <div className="relative w-full" style={{ aspectRatio: '1/1', maxWidth: '600px', margin: '0 auto' }}>
            {/* Use a native img for local demo assets so static PNGs are loaded
                directly from /public without Next image optimization/cache issues. */}
            <img
              src={product.imageUrl}
              width={1024}
              height={1024}
              alt={product.imageAlt}
              className="absolute inset-0 h-full w-full object-contain"
              draggable={false}
              onError={(event) => {
                const img = event.currentTarget;
                if (img.src.endsWith('/assets/images/no_image.png')) return;
                img.src = '/assets/images/no_image.png';
              }}
            />

            {/* Bounding boxes overlay */}
            {showBoxes && (
              <div className="absolute inset-0">
                {product.declarations.map((decl) => {
                  const colors = STATUS_COLORS[decl.status];
                  const isSelected = selectedDeclarationId === decl.id;
                  const isHovered = hoveredDeclarationId === decl.id;
                  const isActive = isSelected || isHovered;

                  return (
                    <button
                      key={`bbox-${decl.id}`}
                      ref={(node) => { evidenceRefs.current[decl.id] = node; }}
                      onClick={() => onSelectDeclaration(decl.id)}
                      onMouseEnter={() => onHoverDeclaration(decl.id)}
                      onMouseLeave={() => onHoverDeclaration(null)}
                      className={`absolute border-2 rounded-sm cursor-pointer transition-all duration-150 group ${colors.box} ${
                        isActive ? `${colors.bg} border-4` : 'hover:border-4'
                      } ${isSelected ? 'ring-2 ring-white ring-offset-1' : ''}`}
                      style={{
                        left: `${decl.boundingBox.x}%`,
                        top: `${decl.boundingBox.y}%`,
                        width: `${decl.boundingBox.width}%`,
                        height: `${decl.boundingBox.height}%`,
                      }}
                      aria-label={`Declaration: ${decl.field} — ${decl.status}`}
                    >
                      {/* Label tooltip */}
                      <div
                        className={`absolute -top-6 left-0 px-1.5 py-0.5 rounded text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10 ${colors.label} ${
                          isSelected ? 'opacity-100' : ''
                        }`}
                      >
                        {decl.field}
                      </div>

                      {/* Confidence chip */}
                      {isActive && (
                        <div className="absolute -bottom-5 left-0 px-1 py-0.5 rounded text-xs font-tabular font-bold bg-navy text-white whitespace-nowrap z-10">
                          {decl.confidence}%
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

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
