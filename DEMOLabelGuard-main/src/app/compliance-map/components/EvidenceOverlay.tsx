'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface EvidenceBoxSpec {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  confidencePct: number;
  colorClass: string;
  activeBgClass: string;
  labelClass: string;
  isActive: boolean;
  isSelected: boolean;
}

interface DisplayRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Props {
  src: string;
  alt: string;
  boxes: EvidenceBoxSpec[];
  showBoxes: boolean;
  registerRef: (id: string, node: HTMLButtonElement | null) => void;
  onSelectBox: (id: string) => void;
  onHoverBox: (id: string | null) => void;
  onImageError?: React.ReactEventHandler<HTMLImageElement>;
}

/**
 * Renders a product image with `object-fit: contain` and overlays evidence
 * boxes whose x/y/width/height are normalized percentages (0-100) of the
 * IMAGE's own dimensions — not of the surrounding container.
 *
 * Because `object-contain` can letterbox the image inside its container
 * (when the image's aspect ratio differs from the container's), this
 * component measures the actual displayed image bounds (accounting for the
 * letterboxing) and converts normalized coordinates into CSS positions
 * relative to those real bounds, so evidence boxes always line up with the
 * pixels they're meant to highlight.
 */
export default function EvidenceOverlay({
  src,
  alt,
  boxes,
  showBoxes,
  registerRef,
  onSelectBox,
  onHoverBox,
  onImageError,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [displayRect, setDisplayRect] = useState<DisplayRect | null>(null);

  const recomputeRect = useCallback(() => {
    const container = containerRef.current;
    const img = imgRef.current;

    if (!container || !img || !img.naturalWidth || !img.naturalHeight) {
      return;
    }

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;

    if (!cw || !ch) return;

    // object-fit: contain math — the image is scaled to fit entirely
    // inside the container, centered, with letterboxing on one axis.
    const scale = Math.min(cw / nw, ch / nh);
    const displayWidth = nw * scale;
    const displayHeight = nh * scale;

    setDisplayRect({
      left: (cw - displayWidth) / 2,
      top: (ch - displayHeight) / 2,
      width: displayWidth,
      height: displayHeight,
    });
  }, []);

  useEffect(() => {
    recomputeRect();

    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => recomputeRect());
    observer.observe(container);

    return () => observer.disconnect();
  }, [recomputeRect, src]);

  return (
    <div ref={containerRef} className="absolute inset-0">
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className="absolute inset-0 h-full w-full object-contain"
        draggable={false}
        onLoad={recomputeRect}
        onError={onImageError}
      />

      {showBoxes && displayRect && (
        <div className="absolute inset-0">
          {boxes.map((box) => {
            const left = displayRect.left + (box.x / 100) * displayRect.width;
            const top = displayRect.top + (box.y / 100) * displayRect.height;
            const width = (box.width / 100) * displayRect.width;
            const height = (box.height / 100) * displayRect.height;

            return (
              <button
                key={`bbox-${box.id}`}
                ref={(node) => registerRef(box.id, node)}
                onClick={() => onSelectBox(box.id)}
                onMouseEnter={() => onHoverBox(box.id)}
                onMouseLeave={() => onHoverBox(null)}
                className={`focus-ring absolute border-2 rounded-sm cursor-pointer transition-all duration-150 group ${box.colorClass} ${
                  box.isActive ? `${box.activeBgClass} border-4` : 'hover:border-4'
                } ${box.isSelected ? 'ring-2 ring-white ring-offset-1' : ''}`}
                style={{
                  left: `${left}px`,
                  top: `${top}px`,
                  width: `${Math.max(width, 4)}px`,
                  height: `${Math.max(height, 4)}px`,
                }}
                aria-label={`Evidence: ${box.label}`}
              >
                <div
                  className={`absolute -top-6 left-0 px-1.5 py-0.5 rounded text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10 ${box.labelClass} ${box.isSelected ? 'opacity-100' : ''}`}
                >
                  {box.label}
                </div>

                {box.isActive && (
                  <div className="absolute -bottom-5 left-0 px-1 py-0.5 rounded text-xs font-tabular font-bold bg-navy text-white whitespace-nowrap z-10">
                    {box.confidencePct}%
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
