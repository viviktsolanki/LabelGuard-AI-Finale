'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Zap, AlertTriangle, Eye, ChevronRight, CheckCircle2 } from 'lucide-react';
import { DEMO_PRODUCTS } from '@/lib/mockData';

const DEMO_META = [
  {
    id: 'product-a-001',
    badge: 'COMPLIANT',
    badgeClass: 'badge-pass',
    icon: <CheckCircle2 size={12} />,
    description: 'All mandatory declarations present, clearly readable, high confidence.',
    accentClass: 'border-pass-border bg-pass-bg',
    scoreColor: 'text-pass',
    statusLabel: 'All Clear',
  },
  {
    id: 'product-b-001',
    badge: 'NON-COMPLIANT',
    badgeClass: 'badge-flag',
    icon: <AlertTriangle size={12} />,
    description: 'Missing consumer care, manufacturer name undetectable, low readability.',
    accentClass: 'border-flag-border bg-flag-bg',
    scoreColor: 'text-flag',
    statusLabel: '3 Flags',
  },
  {
    id: 'product-c-001',
    badge: 'REVIEW REQUIRED',
    badgeClass: 'badge-review',
    icon: <Eye size={12} />,
    description: 'Partial address, borderline MRP readability, batch number missing.',
    accentClass: 'border-review-border bg-review-bg',
    scoreColor: 'text-review',
    statusLabel: '3 Reviews',
  },
];

export default function DemoProductsSection() {
  const router = useRouter();

  const handleDemo = (productId: string) => {
    router.push(`/analysis?product=${productId}&mode=demo`);
  };

  return (
    <div className="card p-6 h-full flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Zap size={16} className="text-accent" />
          <h2 className="text-lg font-bold text-navy">Demo Products</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Three deterministic demo inspections — each finding maps to evidence visible in the label
          image
        </p>
      </div>

      <div className="space-y-3 flex-1">
        {DEMO_PRODUCTS.map((product) => {
          const meta = DEMO_META.find((m) => m.id === product.id)!;
          return (
            <button
              key={`demo-${product.id}`}
              onClick={() => handleDemo(product.id)}
              className={`focus-ring w-full text-left p-4 rounded-xl border transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5 group ${meta.accentClass}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`status-badge ${meta.badgeClass}`}>
                      {meta.icon}
                      {meta.badge}
                    </span>
                    <span className="text-xs text-muted-foreground">{product.category}</span>
                  </div>
                  <p className="text-sm font-semibold text-navy truncate">{product.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {meta.description}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={`text-2xl font-extrabold font-tabular ${meta.scoreColor}`}>
                    {product.qualityScore}
                  </span>
                  <span className="text-xs text-muted-foreground">/ 100</span>
                </div>
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-current/10">
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-pass font-medium">{product.passCount} PASS</span>
                  {product.reviewCount > 0 && (
                    <span className="text-review font-medium">{product.reviewCount} REVIEW</span>
                  )}
                  {product.flagCount > 0 && (
                    <span className="text-flag font-medium">{product.flagCount} FLAG</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground group-hover:text-accent transition-colors">
                  <span>Inspect</span>
                  <ChevronRight
                    size={14}
                    className="group-hover:translate-x-0.5 transition-transform"
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border">
        Demo mode uses deterministic inspection data. No API calls required.
      </div>
    </div>
  );
}
