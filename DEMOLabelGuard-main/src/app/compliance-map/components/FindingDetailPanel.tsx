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
} from 'lucide-react';
import { type Declaration, type Finding } from '@/lib/mockData';

interface Props {
  declaration: Declaration;
  finding: Finding | null;
  productId: string;
}

export default function FindingDetailPanel({ declaration, finding, productId }: Props) {
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

  return (
    <div className="card overflow-hidden animate-slide-in-right">
      {/* Header */}
      <div className={`flex items-start gap-3 px-4 py-3 border-b ${cfg.bgCls}`}>
        {cfg.icon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-navy">
              {declaration.field}
            </h3>
            <span className={`status-badge ${cfg.badgeCls} flex-shrink-0`}>
              {declaration.status}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {finding ? finding.title : `${declaration.field} — ${declaration.status}`}
          </p>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Evidence chain: FINDING → EVIDENCE → EXTRACTED TEXT → CHECK → EXPLANATION → ACTION */}

        {/* Detected / Extracted text */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <FileText size={12} className="text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Detected Text
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-navy/5 border border-border font-mono text-xs text-navy leading-relaxed">
            {declaration.extractedText || declaration.value}
          </div>
        </div>

        {/* Key details grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-xl bg-muted/50">
            <div className="flex items-center gap-1 text-muted-foreground mb-1">
              <Eye size={11} />
              <span className="text-xs font-medium">Confidence</span>
            </div>
            <p className={`text-sm font-bold font-tabular ${
              declaration.confidence >= 80 ? 'text-pass' : declaration.confidence >= 60 ? 'text-review' : 'text-flag'
            }`}>
              {declaration.confidence}%
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-muted/50">
            <div className="flex items-center gap-1 text-muted-foreground mb-1">
              <Eye size={11} />
              <span className="text-xs font-medium">Readability</span>
            </div>
            <p className={`text-xs font-semibold ${
              declaration.readabilityLabel === 'GOOD' ? 'text-pass' : declaration.readabilityLabel === 'ACCEPTABLE' ? 'text-review' : 'text-flag'
            }`}>
              ~{declaration.readabilityPx}px · {declaration.readabilityLabel}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-muted/50 col-span-2">
            <div className="flex items-center gap-1 text-muted-foreground mb-1">
              <MapPin size={11} />
              <span className="text-xs font-medium">Evidence Region</span>
            </div>
            <p className="text-xs font-semibold text-navy">{declaration.sourceRegion}</p>
          </div>
        </div>

        {/* Rule check */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Cpu size={12} className="text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Compliance Check
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-muted/50 font-mono text-xs text-navy">
            {declaration.ruleCheck}
          </div>
        </div>

        {/* Explanation */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Target size={12} className="text-review" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Why {cfg.label}?
            </span>
          </div>
          <p className={`text-xs leading-relaxed rounded-xl p-3 ${cfg.bgCls} border`}>
            {declaration.explanation}
          </p>
        </div>

        {/* Recommended action */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Lightbulb size={12} className="text-accent" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Recommended Action
            </span>
          </div>
          <p className="text-xs text-accent leading-relaxed bg-accent/5 border border-accent/20 rounded-xl p-3">
            {declaration.recommendedAction}
          </p>
        </div>

        {/* Disclaimer */}
        <p className="text-xs text-muted-foreground/70 italic text-center">
          AI-assisted finding. Manual verification recommended.
        </p>

        {/* Ask LabelGuard CTA */}
        <Link
          href={`/copilot?product=${productId}&finding=${finding?.id || declaration.id}`}
          className="btn-secondary w-full text-sm justify-center"
        >
          <MessageSquare size={14} />
          Ask LabelGuard about this finding
          <ChevronRight size={14} />
        </Link>
      </div>
    </div>
  );
}
