'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Code2,
  MapPin,
  Sparkles,
  Video,
} from 'lucide-react';
import { imageLabelFor, type ImageId } from '@/lib/mockData';

interface Props {
  /** Raw JSON string returned by /api/analyze's `analysis` field. */
  aiAnalysisJson: string;
  /** Real per-image video-frame timestamps (seconds), only present for
   * images that actually came from the video scan pipeline. Optional —
   * absent entirely for a plain photo/camera-only upload. Never used to
   * invent evidence, only to label a source badge truthfully when the
   * provenance is known. */
  videoTimestampByImageId?: Partial<Record<ImageId, number>>;
}

interface AiEvidence {
  image?: ImageId;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

interface AiField {
  value: string | null;
  source: ImageId | 'both' | null;
  confidence: number;
  evidence?: AiEvidence | null;
  conflict?: string | null;
}

type AiExtraction = Record<string, AiField | undefined>;

// Human-readable labels for each key in the AI extraction schema
// (mirrors the field list used to build the deterministic ProductAnalysis
// record in src/lib/realProduct.ts).
const FIELD_LABELS: { key: string; label: string }[] = [
  { key: 'product_name', label: 'Product Name' },
  { key: 'brand', label: 'Brand' },
  { key: 'net_quantity', label: 'Net Quantity' },
  { key: 'mrp', label: 'MRP' },
  { key: 'manufacturer', label: 'Manufacturer' },
  { key: 'expiry_date', label: 'Best Before / Expiry' },
  { key: 'manufacturing_date', label: 'Manufacturing Date' },
  { key: 'packaging_date', label: 'Packaging Date' },
  { key: 'use_by_date', label: 'Use By Date' },
  { key: 'customer_care', label: 'Consumer Care' },
  { key: 'batch_number', label: 'Batch / Lot Number' },
  { key: 'ingredients', label: 'Ingredients' },
  { key: 'license_numbers', label: 'License Numbers' },
  { key: 'warnings', label: 'Warnings' },
  { key: 'other_visible_declarations', label: 'Other Declarations' },
];

const SOURCE_BADGE: Record<string, string> = {
  front: 'bg-accent/10 text-accent border-accent/20',
  back: 'bg-navy/10 text-navy border-navy/20',
  both: 'bg-pass/10 text-pass border-pass/20',
};

// Additional views (additional-1..4) share one neutral badge style — there
// can be up to 4 of them, so a per-id color isn't worth the complexity.
const ADDITIONAL_SOURCE_BADGE = 'bg-muted text-muted-foreground border-border';

const confidenceColor = (pct: number) =>
  pct >= 80 ? 'text-pass' : pct >= 50 ? 'text-review' : 'text-flag';

export default function ExtractedLabelData({ aiAnalysisJson, videoTimestampByImageId }: Props) {
  const [showRaw, setShowRaw] = useState(false);

  const fields = useMemo(() => {
    let extraction: AiExtraction = {};

    try {
      extraction = JSON.parse(aiAnalysisJson) as AiExtraction;
    } catch {
      extraction = {};
    }

    return FIELD_LABELS.map(({ key, label }) => {
      const raw = extraction[key];
      const value = (raw?.value ?? '').toString().trim();
      const hasValue = value.length > 0;
      const confidencePct = Math.round(
        (typeof raw?.confidence === 'number' ? raw.confidence : 0) * 100
      );

      return {
        key,
        label,
        value: hasValue ? value : 'Not detected',
        hasValue,
        source: raw?.source ?? null,
        confidencePct,
        hasEvidence: Boolean(raw?.evidence && raw.evidence.image),
        conflict: typeof raw?.conflict === 'string' && raw.conflict.trim().length > 0 ? raw.conflict.trim() : null,
      };
    });
  }, [aiAnalysisJson]);

  return (
    <div className="p-4 rounded-xl bg-muted/50 border border-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Sparkles size={14} className="text-accent" />
          <p className="text-sm font-bold text-navy">
            AI Extracted Label Data
          </p>
        </div>

        <button
          onClick={() => setShowRaw((v) => !v)}
          className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-accent transition-colors"
        >
          <Code2 size={12} />
          {showRaw ? 'Hide' : 'View'} raw AI extraction
          {showRaw ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      <div className="space-y-2">
        {fields.map((f) => (
          <div
            key={f.key}
            className={`flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 px-3 py-2.5 rounded-lg bg-card border ${f.conflict ? 'border-review' : 'border-border'}`}
          >
            <div className="sm:w-40 flex-shrink-0">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {f.label}
              </p>
            </div>

            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium truncate ${
                  f.hasValue ? 'text-navy' : 'text-muted-foreground italic'
                }`}
              >
                {f.value}
              </p>
              {f.conflict && (
                <p className="text-xs text-review flex items-center gap-1 mt-0.5">
                  <AlertTriangle size={11} className="flex-shrink-0" />
                  <span className="truncate">{f.conflict}</span>
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {f.source && (
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border flex items-center gap-1 ${
                    SOURCE_BADGE[f.source] || ADDITIONAL_SOURCE_BADGE
                  }`}
                >
                  {f.source === 'both' ? 'Both' : imageLabelFor(f.source)}
                  {f.source !== 'both' && videoTimestampByImageId?.[f.source] !== undefined && (
                    <span
                      className="flex items-center gap-0.5"
                      title={`Detected from a video frame at ${videoTimestampByImageId[f.source]!.toFixed(1)}s`}
                    >
                      <Video size={10} />
                      {videoTimestampByImageId[f.source]!.toFixed(1)}s
                    </span>
                  )}
                </span>
              )}

              {f.hasValue && (
                <span className={`text-xs font-tabular font-bold ${confidenceColor(f.confidencePct)}`}>
                  {f.confidencePct}%
                </span>
              )}

              {f.hasEvidence && (
                <MapPin size={12} className="text-accent" aria-label="Evidence location available" />
              )}
            </div>
          </div>
        ))}
      </div>

      {showRaw && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs font-semibold text-muted-foreground mb-2">
            Technical details — raw AI extraction JSON
          </p>
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words max-h-[420px] overflow-auto p-2.5 rounded-lg bg-navy/5">
            {aiAnalysisJson}
          </pre>
        </div>
      )}
    </div>
  );
}
