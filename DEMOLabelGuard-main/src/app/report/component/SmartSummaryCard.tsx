'use client';

import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Target,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import type { ProductAnalysis } from '@/lib/mockData';
import { getComplianceInsights, type OverallComplianceStatus } from '@/lib/complianceInsights';

function OverallStatusBadge({ status }: { status: OverallComplianceStatus }) {
  if (status === 'COMPLIANT')
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pass/10 text-pass text-xs font-bold">
        <CheckCircle2 size={12} /> COMPLIANT
      </span>
    );
  if (status === 'NEEDS REVIEW')
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-review/10 text-review text-xs font-bold">
        <AlertCircle size={12} /> NEEDS REVIEW
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-flag/10 text-flag text-xs font-bold">
      <XCircle size={12} /> NON-COMPLIANT
    </span>
  );
}

export default function SmartSummaryCard({ product }: { product: ProductAnalysis }) {
  const insights = getComplianceInsights(product);

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-accent" />
          <h2 className="text-sm font-bold text-navy">Smart Compliance Summary</h2>
        </div>
        <OverallStatusBadge status={insights.overallStatus} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Overall Score</p>
          <p className="text-lg font-bold text-navy">{insights.overallScore} / 100</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">PASS</p>
          <p className="text-lg font-bold text-pass">{insights.passCount}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">REVIEW</p>
          <p className="text-lg font-bold text-review">{insights.reviewCount}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">FLAG</p>
          <p className="text-lg font-bold text-flag">{insights.flagCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-muted/40">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Most Critical Issue</p>
          <p className="text-sm text-navy leading-relaxed">
            {insights.mostCriticalIssue
              ? insights.mostCriticalIssue.title
              : 'No critical issues detected.'}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-accent/5 border border-accent/20">
          <p className="text-xs font-semibold text-accent mb-1 flex items-center gap-1">
            <ArrowRight size={11} /> Recommended Next Action
          </p>
          <p className="text-sm text-accent leading-relaxed">{insights.recommendedNextAction}</p>
        </div>
      </div>

      {(insights.strongestArea || insights.weakestArea) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {insights.strongestArea && (
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-pass/5">
              <TrendingUp size={16} className="text-pass flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Strongest Area</p>
                <p className="text-sm font-semibold text-navy">
                  {insights.strongestArea.label}{' '}
                  <span className="text-pass">({insights.strongestArea.value})</span>
                </p>
              </div>
            </div>
          )}
          {insights.weakestArea && (
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-flag/5">
              <TrendingDown size={16} className="text-flag flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Weakest Area</p>
                <p className="text-sm font-semibold text-navy">
                  {insights.weakestArea.label}{' '}
                  <span className="text-flag">({insights.weakestArea.value})</span>
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
