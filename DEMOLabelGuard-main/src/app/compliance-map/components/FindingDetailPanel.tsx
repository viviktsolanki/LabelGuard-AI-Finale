'use client';

import React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  XCircle,
  CheckCircle2,
  MapPin,
  FileText,
  Cpu,
  Lightbulb,
  MessageSquare,
  ChevronRight,
  Eye,
  Target,
  ScanSearch,
  ImageOff,
  Maximize2,
} from 'lucide-react';
import {
  type BoundingBox,
  type Declaration,
  type DeclarationStatus,
  type Finding,
} from '@/lib/mockData';
import { getConfidenceSource, describeConfidenceSource } from '@/lib/complianceInsights';
import EvidenceExcerpt from './EvidenceExcerpt';

interface Props {
  declaration: Declaration;
  finding: Finding | null;
  productId: string;
  /** Real image URL the evidence excerpt should be cropped from, or null
   * when no reliable location is available for this declaration — never a
   * guessed/placeholder image. */
  evidenceImageUrl: string | null;
  /** Real, already-validated normalized (0-100%) region on that image, or
   * null alongside `evidenceImageUrl`. */
  evidenceRegion: BoundingBox | null;
}

const EVIDENCE_EXCERPT_COLORS: Record<DeclarationStatus, { border: string; fill: string }> = {
  PASS: { border: 'border-pass', fill: 'bg-pass/20' },
  REVIEW: { border: 'border-review', fill: 'bg-review/20' },
  FLAG: { border: 'border-flag', fill: 'bg-flag/20' },
};

const scrollToFullImage = () => {
  document
    .getElementById('compliance-map-image')
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

export default function FindingDetailPanel({
  declaration,
  finding,
  productId,
  evidenceImageUrl,
  evidenceRegion,
}: Props) {
  const statusConfig = {
    PASS: {
      icon: <CheckCircle2 size={16} className="text-pass" />,
      badgeCls: 'badge-pass',
      bgCls: 'bg-pass-bg border-pass-border',
      label: 'PASS',
    },
    REVIEW: {
      icon: <AlertTriangle size={16} className="text-review" />,
      badgeCls: 'badge-review',
      bgCls: 'bg-review-bg border-review-border',
      label: 'REVIEW',
    },
    FLAG: {
      icon: <XCircle size={16} className="text-flag" />,
      badgeCls: 'badge-flag',
      bgCls: 'bg-flag-bg border-flag-border',
      label: 'FLAG',
    },
  };

  const cfg = statusConfig[declaration.status];
  const isActionable = declaration.status !== 'PASS';
  // Source of confidence — what the AI detected vs. what the
  // deterministic Bharat Validator actually checked vs. whether real
  // evidence was located on the image, so trust isn't reduced to one
  // number. Reuses the exact same helper (and wording) the Report page
  // already uses, so the two pages never disagree. Only built when
  // there's a finding to attach it to (PASS declarations have none).
  const confidenceSource = finding ? getConfidenceSource(finding, declaration) : null;
  // The action box carries the same severity color as the finding itself,
  // so the fix is visually tied to how urgent the issue is.
  const actionBoxCls =
    declaration.status === 'FLAG'
      ? 'bg-flag-bg border-flag-border text-flag'
      : declaration.status === 'REVIEW'
        ? 'bg-review-bg border-review-border text-review'
        : 'bg-accent/5 border-accent/20 text-accent';

  return (
    <div className="card overflow-hidden animate-slide-in-right">
      {/* Header */}
      <div className={`flex items-start gap-3 px-4 py-3 border-b ${cfg.bgCls}`}>
        {cfg.icon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Field
              </span>
              <h3 className="text-sm font-bold text-navy truncate">{declaration.field}</h3>
            </div>
            <span className={`status-badge ${cfg.badgeCls} flex-shrink-0`}>
              {declaration.status}
            </span>
          </div>
          {finding && (
            <p className="text-xs text-muted-foreground mt-1.5">
              <span className="font-semibold text-navy">Issue: </span>
              {finding.title}
            </p>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Answer the three questions that matter, in order: what's wrong
            (the detected text behind the issue named above), why it
            matters (the existing explanation field), and what to do (the
            existing recommended action). Supporting evidence (confidence,
            readability, region, rule id) follows underneath as reference
            detail rather than competing with the answer. Content is
            unchanged from the underlying analysis — only the labeling and
            visual order changed. */}

        {/* 1. What's wrong — the detected text that triggered the issue named above */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <FileText size={12} className="text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              What&apos;s Wrong — Detected Text
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-navy/5 border border-border font-mono text-xs text-navy leading-relaxed">
            {declaration.extractedText || declaration.value}
          </div>
        </div>

        {/* 1b. Visual proof — a zoomed crop of the actual label image
            centered on this declaration's real, validated evidence region.
            Shown in place so it doesn't depend on the full label image
            still being visible (e.g. scrolled off-screen on mobile).
            Falls back to an honest "not located" note rather than ever
            rendering a guessed or placeholder box. */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5">
              <ScanSearch size={12} className="text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Evidence On Label
              </span>
            </div>
            {evidenceImageUrl && evidenceRegion && (
              <button
                type="button"
                onClick={scrollToFullImage}
                className="focus-ring flex items-center gap-1 text-xs font-medium text-accent hover:underline"
              >
                <Maximize2 size={11} />
                View full image
              </button>
            )}
          </div>

          {evidenceImageUrl && evidenceRegion ? (
            <EvidenceExcerpt
              src={evidenceImageUrl}
              alt={`Zoomed crop of the label showing the evidence for ${declaration.field}`}
              region={evidenceRegion}
              borderClass={EVIDENCE_EXCERPT_COLORS[declaration.status].border}
              fillClass={EVIDENCE_EXCERPT_COLORS[declaration.status].fill}
            />
          ) : (
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-muted/50 border border-border">
              <ImageOff size={14} className="text-muted-foreground/70 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Exact position on the image wasn&apos;t confidently located — this finding is based
                on the detected text above only.
                {declaration.sourceRegion && declaration.sourceRegion !== 'Not detected'
                  ? ` Reported from: ${declaration.sourceRegion}.`
                  : ''}
              </p>
            </div>
          )}
        </div>

        {/* 2. Why it matters — only shown when there's actually a concern */}
        {isActionable && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Target size={12} className="text-review" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Why It Matters
              </span>
            </div>
            <p className={`text-sm leading-relaxed rounded-xl p-3 border ${cfg.bgCls}`}>
              {declaration.explanation}
            </p>
          </div>
        )}

        {/* 3. What to do next — the recommended action, most prominent */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Lightbulb
              size={12}
              className={isActionable ? '' : 'text-accent'}
              style={
                isActionable
                  ? { color: declaration.status === 'FLAG' ? 'var(--flag)' : 'var(--review)' }
                  : undefined
              }
            />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {isActionable ? 'What To Do Next' : 'Status'}
            </span>
          </div>
          <p
            className={`text-sm font-medium leading-relaxed rounded-xl p-3 border ${actionBoxCls}`}
          >
            {declaration.recommendedAction}
          </p>
        </div>

        {/* Evidence detail — reference material, de-emphasized below the answer */}
        <div className="pt-1 border-t border-border space-y-2">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Cpu size={11} className="text-muted-foreground/70" />
            <span className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
              Evidence Detail
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-xl bg-muted/50">
              <div className="flex items-center gap-1 text-muted-foreground mb-1">
                <Eye size={11} />
                <span className="text-xs font-medium">Confidence</span>
              </div>
              <p
                className={`text-sm font-bold font-tabular ${
                  declaration.confidence >= 80
                    ? 'text-pass'
                    : declaration.confidence >= 60
                      ? 'text-review'
                      : 'text-flag'
                }`}
              >
                {declaration.confidence}%
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-muted/50">
              <div className="flex items-center gap-1 text-muted-foreground mb-1">
                <Eye size={11} />
                <span className="text-xs font-medium">Readability</span>
              </div>
              <p
                className={`text-xs font-semibold ${
                  declaration.readabilityLabel === 'GOOD'
                    ? 'text-pass'
                    : declaration.readabilityLabel === 'ACCEPTABLE'
                      ? 'text-review'
                      : 'text-flag'
                }`}
              >
                ~{declaration.readabilityPx}px · {declaration.readabilityLabel}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-muted/50">
              <div className="flex items-center gap-1 text-muted-foreground mb-1">
                <MapPin size={11} />
                <span className="text-xs font-medium">Evidence Region</span>
              </div>
              <p className="text-xs font-semibold text-navy">{declaration.sourceRegion}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-muted/50">
              <div className="flex items-center gap-1 text-muted-foreground mb-1">
                <Cpu size={11} />
                <span className="text-xs font-medium">Compliance Check</span>
              </div>
              <p className="text-xs font-mono font-semibold text-navy truncate">
                {declaration.ruleCheck}
              </p>
            </div>
          </div>
        </div>

        {/* Source of confidence — distinguishes what the AI detected,
            what the deterministic rule engine validated, and whether
            real evidence was located on the image, so the finding isn't
            trusted on a single opaque percentage. Same wording as the
            Report page (src/lib/complianceInsights.ts). */}
        {confidenceSource && (
          <p className="text-[11px] text-muted-foreground/70 leading-relaxed pt-1 border-t border-border">
            <span className="font-semibold uppercase tracking-wide mr-1">
              Source of confidence:
            </span>
            {describeConfidenceSource(confidenceSource)}
          </p>
        )}

        {/* Disclaimer */}
        <p className="text-xs text-muted-foreground/70 italic text-center">
          AI-assisted finding. Manual verification recommended.
        </p>

        {/* Ask LabelGuard CTA */}
        <Link
          href={`/copilot?product=${productId}&finding=${finding?.id || declaration.id}`}
          className="focus-ring btn-secondary w-full text-sm justify-center"
        >
          <MessageSquare size={14} />
          Ask LabelGuard about this finding
          <ChevronRight size={14} />
        </Link>
      </div>
    </div>
  );
}