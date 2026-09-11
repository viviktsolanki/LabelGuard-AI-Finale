'use client';

/**
 * Phase 5C — Compliance Map results summary.
 *
 * Top-level "understand results faster" hierarchy for the Compliance Map:
 * score, overall status, PASS/REVIEW/FLAG counts, the most critical
 * existing finding, and the recommended next action. All values come from
 * the existing `complianceInsights.ts` helpers (Phase 4A) — no new scoring,
 * no fabricated insights, just organizing data that already exists.
 */

import React from 'react';
import Link from 'next/link';
import { CheckCircle2, AlertTriangle, XCircle, ArrowRight, MessageSquare } from 'lucide-react';
import { type ProductAnalysis } from '@/lib/mockData';
import { getComplianceInsights, type OverallComplianceStatus } from '@/lib/complianceInsights';

interface Props {
  product: ProductAnalysis;
  /** Selects the declaration behind the most critical finding — reuses the
   * same handler the findings list and image map already use, so it also
   * switches to the correct image side and scrolls/zooms to the evidence. */
  onSelectCriticalFinding: (declarationId: string) => void;
}

const OVERALL_CONFIG: Record<
  OverallComplianceStatus,
  { label: string; icon: React.ReactNode; cls: string }
> = {
  COMPLIANT: { label: 'Compliant', icon: <CheckCircle2 size={14} />, cls: 'badge-pass' },
  'NEEDS REVIEW': { label: 'Needs Review', icon: <AlertTriangle size={14} />, cls: 'badge-review' },
  'NON-COMPLIANT': { label: 'Non-Compliant', icon: <XCircle size={14} />, cls: 'badge-flag' },
};

export default function ResultsSummary({ product, onSelectCriticalFinding }: Props) {
  const insights = getComplianceInsights(product);
  const overallCfg = OVERALL_CONFIG[insights.overallStatus];
  const isClean = insights.flagCount === 0 && insights.reviewCount === 0;

  const criticalDeclaration = insights.mostCriticalIssue
    ? product.declarations.find((d) => d.id === insights.mostCriticalIssue!.declarationId) || null
    : null;

  // Tie the "most critical finding" card's color to its actual severity so
  // the highest-impact issue is visually distinguishable at a glance, not
  // just textually labeled.
  const criticalCardCls =
    insights.mostCriticalIssue?.severity === 'FLAG'
      ? 'bg-flag-bg border-flag-border hover:bg-flag-bg/80'
      : insights.mostCriticalIssue?.severity === 'REVIEW'
        ? 'bg-review-bg border-review-border hover:bg-review-bg/80'
        : 'bg-muted/50 border-transparent hover:bg-muted';

  return (
    <section aria-label="Compliance results summary" className="card p-4 sm:p-5 space-y-4">
      {/* Score + overall status + counts */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="text-2xl font-extrabold font-tabular text-navy"
            aria-label={`Compliance screening score ${insights.overallScore} out of 100`}
          >
            {insights.overallScore}
            <span className="text-sm text-muted-foreground font-semibold">/100</span>
          </span>
          <span className={`status-badge ${overallCfg.cls}`}>
            {overallCfg.icon}
            {overallCfg.label}
          </span>
        </div>

        <ul className="flex items-center gap-2 flex-wrap" aria-label="Finding counts by status">
          <li className="status-badge badge-flag">
            <XCircle size={12} aria-hidden="true" />
            {insights.flagCount} Flag
          </li>
          <li className="status-badge badge-review">
            <AlertTriangle size={12} aria-hidden="true" />
            {insights.reviewCount} Review
          </li>
          <li className="status-badge badge-pass">
            <CheckCircle2 size={12} aria-hidden="true" />
            {insights.passCount} Pass
          </li>
        </ul>
      </div>

      {/* Clean state vs. critical issue + next action */}
      {isClean ? (
        <div className="flex items-center gap-3 rounded-xl bg-pass-bg border border-pass-border px-4 py-3">
          <CheckCircle2 size={20} className="text-pass flex-shrink-0" aria-hidden="true" />
          <p className="text-sm text-navy">
            All mandatory declarations passed compliance checks. No action needed.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => criticalDeclaration && onSelectCriticalFinding(criticalDeclaration.id)}
            disabled={!criticalDeclaration}
            className={`focus-ring text-left p-3 rounded-xl border transition-colors duration-150 disabled:cursor-default ${criticalCardCls}`}
            aria-label={
              criticalDeclaration
                ? `View most critical finding on the compliance map: ${insights.mostCriticalIssue?.title}`
                : 'Most critical finding'
            }
          >
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Most Critical Finding
              {insights.mostCriticalIssue && (
                <span
                  className={
                    insights.mostCriticalIssue.severity === 'FLAG' ? 'text-flag' : 'text-review'
                  }
                >
                  {' '}
                  ({insights.mostCriticalIssue.severity})
                </span>
              )}
            </p>
            <p className="text-sm font-semibold text-navy leading-relaxed">
              {insights.mostCriticalIssue?.title}
            </p>
            {criticalDeclaration && (
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {criticalDeclaration.field}
              </p>
            )}
          </button>

          <div className="p-3 rounded-xl bg-accent/5 border border-accent/20">
            <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-1 flex items-center gap-1">
              <ArrowRight size={11} aria-hidden="true" />
              Recommended Next Action
            </p>
            <p className="text-sm text-accent leading-relaxed">{insights.recommendedNextAction}</p>
            <Link
              href={`/copilot?product=${product.id}${
                insights.mostCriticalIssue ? `&finding=${insights.mostCriticalIssue.id}` : ''
              }`}
              className="focus-ring inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-accent hover:underline"
            >
              <MessageSquare size={12} aria-hidden="true" />
              Ask LabelGuard about this
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
