'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface EvidenceExcerptRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  src: string;
  alt: string;
  region: EvidenceExcerptRegion;
  /** Tailwind border color class for the highlight box, e.g. `border-flag`. */
  borderClass: string;
  /** Tailwind background color class (low-opacity) for the highlight box fill. */
  fillClass: string;
  onImageError?: React.ReactEventHandler<HTMLImageElement>;
}

interface DisplayGeometry {
  imgLeft: number;
  imgTop: number;
  imgWidth: number;
  imgHeight: number;
  boxLeft: number;
  boxTop: number;
  boxWidth: number;
  boxHeight: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * Shows a zoomed-in crop of `src` centered on `region` (a normalized 0-100
 * percent box, in the SAME coordinate space EvidenceOverlay already uses),
 * with a highlight rectangle drawn over the exact evidence box. This is the
 * "evidence excerpt" — it answers "what does the AI actually see" right next
 * to a finding's explanation, without requiring the user to scroll to (or
 * find, on a small screen) the full label image above.
 *
 * All math is derived from the real, already-validated region passed in —
 * nothing here invents or estimates a coordinate. If the region is
 * degenerate (zero width/height), the caller should not render this
 * component at all and should show the "no visual location" fallback
 * instead (see FindingDetailPanel).
 */
export default function EvidenceExcerpt({
  src,
  alt,
  region,
  borderClass,
  fillClass,
  onImageError,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [geometry, setGeometry] = useState<DisplayGeometry | null>(null);

  const recompute = useCallback(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img || !img.naturalWidth || !img.naturalHeight) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (!cw || !ch) return;

    const nw = img.naturalWidth;
    const nh = img.naturalHeight;

    // Pad the region with surrounding context so the excerpt shows more
    // than just the bare text — proportional to the box's own size, with a
    // floor so very small boxes (a short batch number, say) still show
    // enough of the label around them to orient the viewer.
    const padX = Math.max(region.width * 0.6, 8);
    const padY = Math.max(region.height * 0.6, 8);

    let px = clamp(region.x - padX, 0, 100);
    let py = clamp(region.y - padY, 0, 100);
    const pEndX = clamp(region.x + region.width + padX, 0, 100);
    const pEndY = clamp(region.y + region.height + padY, 0, 100);

    let pw = pEndX - px;
    let ph = pEndY - py;

    // Degenerate padded region (shouldn't normally happen given the
    // clamps above) — fall back to showing the whole image rather than
    // rendering nothing.
    if (pw <= 0) {
      px = 0;
      pw = 100;
    }
    if (ph <= 0) {
      py = 0;
      ph = 100;
    }

    // "Contain" the padded region inside the excerpt box (never crop off
    // part of the padded context) — mirrors EvidenceOverlay's object-fit:
    // contain math, just centered on the padded region instead of the
    // whole image.
    const scale = Math.min(cw / ((pw / 100) * nw), ch / ((ph / 100) * nh));

    const imgWidth = nw * scale;
    const imgHeight = nh * scale;
    const paddedDisplayWidth = (pw / 100) * nw * scale;
    const paddedDisplayHeight = (ph / 100) * nh * scale;

    const imgLeft = (cw - paddedDisplayWidth) / 2 - (px / 100) * nw * scale;
    const imgTop = (ch - paddedDisplayHeight) / 2 - (py / 100) * nh * scale;

    setGeometry({
      imgLeft,
      imgTop,
      imgWidth,
      imgHeight,
      boxLeft: imgLeft + (region.x / 100) * nw * scale,
      boxTop: imgTop + (region.y / 100) * nh * scale,
      boxWidth: (region.width / 100) * nw * scale,
      boxHeight: (region.height / 100) * nh * scale,
    });
  }, [region.x, region.y, region.width, region.height]);

  useEffect(() => {
    recompute();

    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => recompute());
    observer.observe(container);

    return () => observer.disconnect();
  }, [recompute]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-36 sm:h-44 overflow-hidden rounded-xl bg-slate-900"
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className="absolute"
        draggable={false}
        onLoad={recompute}
        onError={onImageError}
        style={
          geometry
            ? {
                left: `${geometry.imgLeft}px`,
                top: `${geometry.imgTop}px`,
                width: `${geometry.imgWidth}px`,
                height: `${geometry.imgHeight}px`,
                maxWidth: 'none',
              }
            : { opacity: 0 }
        }
      />

      {geometry && (
        <div
          className={`absolute border-2 rounded-sm ${borderClass} ${fillClass} animate-evidence-pulse`}
          style={{
            left: `${geometry.boxLeft}px`,
            top: `${geometry.boxTop}px`,
            width: `${Math.max(geometry.boxWidth, 3)}px`,
            height: `${Math.max(geometry.boxHeight, 3)}px`,
          }}
        />
      )}
    </div>
  );
}
