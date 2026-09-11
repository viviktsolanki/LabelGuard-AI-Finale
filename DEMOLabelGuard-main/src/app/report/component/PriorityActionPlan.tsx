'use client';

import React from 'react';
import { XCircle, AlertCircle, CheckCircle2, ListChecks } from 'lucide-react';
import type { ProductAnalysis } from '@/lib/mockData';
import { buildPriorityActionPlan, type PriorityAction } from '@/lib/complianceInsights';

const BORDER_CLASS: Record<PriorityAction['status'], string> = {
  FLAG: 'border-l-4 border-l-flag',
  REVIEW: 'border-l-4 border-l-review',
  PASS: 'border-l-4 border-l-pass',
};

const ACTION_LABEL_CLASS: Record<PriorityAction['status'], string> = {
  FLAG: 'text-flag',
  REVIEW: 'text-review',
  PASS: 'text-pass',
};

function ActionGroup({
  title,
  icon,
  colorClass,
  actions,
}: {
  title: string;
  icon: React.ReactNode;
  colorClass: string;
  actions: PriorityAction[];
}) {
  if (actions.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        {icon}
        <p className={`text-xs font-bold uppercase tracking-wide ${colorClass}`}>{title}</p>
      </div>
      <ul className="space-y-2">
        {actions.map((action) => (
          <li
            key={action.id}
            className={`p-3 rounded-lg bg-muted/30 border border-border ${BORDER_CLASS[action.status]}`}
          >
            {/* What's wrong */}
            <p className="text-sm font-semibold text-navy leading-snug">
              {action.issue}
              {action.declarationField ? (
                <span className="font-normal text-muted-foreground">
                  {' '}
                  — {action.declarationField}
                </span>
              ) : null}
            </p>

            {/* Why it matters */}
            {action.explanation && (
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                {action.explanation}
              </p>
            )}

            {/* What to do next */}
            <p
              className={`text-xs font-medium mt-1.5 leading-relaxed ${ACTION_LABEL_CLASS[action.status]}`}
            >
              <span className="font-bold uppercase tracking-wide text-[10px] mr-1">Do this:</span>
              {action.recommendation}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PriorityActionPlan({ product }: { product: ProductAnalysis }) {
  const plan = buildPriorityActionPlan(product);
  const isEmpty =
    plan.priority1.length === 0 && plan.priority2.length === 0 && plan.priority3.length === 0;

  if (isEmpty) return null;

  return (
    <div className="card p-5 space-y-5">
      <div className="flex items-center gap-2">
        <ListChecks size={16} className="text-accent" />
        <h2 className="text-sm font-bold text-navy">Priority Action Plan</h2>
      </div>

      <ActionGroup
        title="Priority 1 — Critical"
        icon={<XCircle size={13} className="text-flag" />}
        colorClass="text-flag"
        actions={plan.priority1}
      />
      <ActionGroup
        title="Priority 2 — Important"
        icon={<AlertCircle size={13} className="text-review" />}
        colorClass="text-review"
        actions={plan.priority2}
      />
      <ActionGroup
        title="Priority 3 — Recommended"
        icon={<CheckCircle2 size={13} className="text-pass" />}
        colorClass="text-pass"
        actions={plan.priority3}
      />
    </div>
  );
}
