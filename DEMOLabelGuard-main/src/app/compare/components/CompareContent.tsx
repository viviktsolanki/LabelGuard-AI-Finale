'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { GitCompare, ChevronDown, CheckCircle2, AlertCircle, XCircle, ArrowRight } from 'lucide-react';
import { DEMO_PRODUCTS, type ProductAnalysis } from '@/lib/mockData';

function StatusBadge({ status }: { status: 'PASS' | 'REVIEW' | 'FLAG' }) {
  if (status === 'PASS')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-pass/10 text-pass text-xs font-semibold">
        <CheckCircle2 size={10} /> PASS
      </span>
    );
  if (status === 'REVIEW')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-review/10 text-review text-xs font-semibold">
        <AlertCircle size={10} /> REVIEW
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-flag/10 text-flag text-xs font-semibold">
      <XCircle size={10} /> FLAG
    </span>
  );
}

function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 85 ? '#22c55e' : score >= 70 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={6} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeDasharray={`${fill} ${circ - fill}`}
        strokeLinecap="round"
      />
    </svg>
  );
}

function ProductSelector({
  label,
  selected,
  onChange,
}: {
  label: string;
  selected: ProductAnalysis;
  onChange: (p: ProductAnalysis) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-border bg-card hover:bg-muted transition-all text-sm font-medium text-navy"
      >
        <span className="truncate">{label}: {selected.name}</span>
        <ChevronDown size={14} className={`flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          {DEMO_PRODUCTS.map((p) => (
            <button
              key={p.id}
              onClick={() => { onChange(p); setOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-muted transition-all ${selected.id === p.id ? 'bg-accent/5 text-accent font-semibold' : 'text-foreground'}`}
            >
              <span>{p.name}</span>
              <span className="text-xs text-muted-foreground">Score {p.qualityScore}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const COMPARE_FIELDS = [
  { key: 'qualityScore', label: 'Compliance Screening Score', render: (p: ProductAnalysis) => `${p.qualityScore} / 100` },
  { key: 'passCount', label: 'PASS findings', render: (p: ProductAnalysis) => String(p.passCount) },
  { key: 'reviewCount', label: 'REVIEW findings', render: (p: ProductAnalysis) => String(p.reviewCount) },
  { key: 'flagCount', label: 'FLAG findings', render: (p: ProductAnalysis) => String(p.flagCount) },
  { key: 'mandatoryDeclarations', label: 'Mandatory declarations', render: (p: ProductAnalysis) => `${p.scoreBreakdown.mandatoryDeclarations}` },
  { key: 'readability', label: 'Readability score', render: (p: ProductAnalysis) => `${p.scoreBreakdown.readability}` },
  { key: 'extractionConfidence', label: 'Extraction confidence', render: (p: ProductAnalysis) => `${p.scoreBreakdown.extractionConfidence}` },
  { key: 'placementVisibility', label: 'Placement / visibility', render: (p: ProductAnalysis) => `${p.scoreBreakdown.placementVisibility}` },
  { key: 'labelConsistency', label: 'Label consistency', render: (p: ProductAnalysis) => `${p.scoreBreakdown.labelConsistency}` },
  { key: 'avgReadability', label: 'Avg. readability (px)', render: (p: ProductAnalysis) => {
    const avg = p.declarations.reduce((s, d) => s + d.readabilityPx, 0) / (p.declarations.length || 1);
    return `${avg.toFixed(1)} px`;
  }},
  { key: 'avgConfidence', label: 'Avg. extraction confidence', render: (p: ProductAnalysis) => {
    const avg = p.declarations.reduce((s, d) => s + d.confidence, 0) / (p.declarations.length || 1);
    return `${avg.toFixed(0)}%`;
  }},
  { key: 'violations', label: 'Violations (FLAG + REVIEW)', render: (p: ProductAnalysis) => String(p.flagCount + p.reviewCount) },
  { key: 'missing', label: 'Missing / undetected', render: (p: ProductAnalysis) => String(p.declarations.filter(d => d.value.toLowerCase().includes('not confidently')).length) },
];

export default function CompareContent() {
  const [productA, setProductA] = useState<ProductAnalysis>(DEMO_PRODUCTS[0]);
  const [productB, setProductB] = useState<ProductAnalysis>(DEMO_PRODUCTS[1]);

  const aWins = productA.qualityScore >= productB.qualityScore;
  const diff = Math.abs(productA.qualityScore - productB.qualityScore);

  return (
    <div className="max-w-screen-xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <GitCompare size={20} className="text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-navy">Compare Products</h1>
          <p className="text-sm text-muted-foreground">Side-by-side compliance screening comparison</p>
        </div>
      </div>

      {/* Product selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-4 space-y-3">
          <p className="text-xs font-bold text-accent uppercase tracking-wide">Product A</p>
          <ProductSelector label="Product A" selected={productA} onChange={setProductA} />
          <div className="flex items-center gap-3">
            <ScoreRing score={productA.qualityScore} size={52} />
            <div>
              <p className="text-2xl font-extrabold text-navy">{productA.qualityScore}<span className="text-sm font-normal text-muted-foreground"> / 100</span></p>
              <p className="text-xs text-muted-foreground">{productA.category} · {productA.analyzedAt}</p>
            </div>
          </div>
        </div>
        <div className="card p-4 space-y-3">
          <p className="text-xs font-bold text-review uppercase tracking-wide">Product B</p>
          <ProductSelector label="Product B" selected={productB} onChange={setProductB} />
          <div className="flex items-center gap-3">
            <ScoreRing score={productB.qualityScore} size={52} />
            <div>
              <p className="text-2xl font-extrabold text-navy">{productB.qualityScore}<span className="text-sm font-normal text-muted-foreground"> / 100</span></p>
              <p className="text-xs text-muted-foreground">{productB.category} · {productB.analyzedAt}</p>
            </div>
          </div>
        </div>
      </div>

      {/* AI Summary */}
      <div className="card p-4 border-l-4 border-accent bg-accent/5">
        <p className="text-sm font-semibold text-navy mb-1">AI Comparison Summary</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {aWins
            ? `${productA.name} scores ${diff} points higher than ${productB.name}. `
            : `${productB.name} scores ${diff} points higher than ${productA.name}. `}
          {productB.flagCount > 0
            ? `${productB.name} has ${productB.flagCount} FLAG finding${productB.flagCount > 1 ? 's' : ''} requiring manual verification.`
            : `Both products have no FLAG findings.`}
          {productA.reviewCount + productB.reviewCount > 0
            ? ` A combined ${productA.reviewCount + productB.reviewCount} REVIEW item${productA.reviewCount + productB.reviewCount > 1 ? 's' : ''} warrant attention.`
            : ''}
        </p>
      </div>

      {/* Comparison table */}
      <div className="card overflow-hidden">
        <div className="grid grid-cols-3 bg-muted/50 border-b border-border px-5 py-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Metric</p>
          <p className="text-xs font-bold text-accent uppercase tracking-wide text-center">Product A</p>
          <p className="text-xs font-bold text-review uppercase tracking-wide text-center">Product B</p>
        </div>
        {COMPARE_FIELDS.map((field, i) => {
          const aVal = field.render(productA);
          const bVal = field.render(productB);
          return (
            <div key={field.key} className={`grid grid-cols-3 px-5 py-3.5 border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/20'}`}>
              <p className="text-sm text-muted-foreground font-medium">{field.label}</p>
              <p className="text-sm font-semibold text-navy text-center">{aVal}</p>
              <p className="text-sm font-semibold text-navy text-center">{bVal}</p>
            </div>
          );
        })}
      </div>

      {/* Declaration-level comparison */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-bold text-navy">Declaration-Level Comparison</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Status of each mandatory declaration field</p>
        </div>
        {['Product Name', 'Net Quantity', 'MRP', 'Manufacturer Name', 'Manufacturer Address', 'Best Before / Expiry', 'Consumer Care'].map((field) => {
          const aDecl = productA.declarations.find(d => d.field === field);
          const bDecl = productB.declarations.find(d => d.field === field);
          return (
            <div key={field} className="grid grid-cols-3 px-5 py-3 border-b border-border last:border-0 items-center">
              <p className="text-sm text-muted-foreground">{field}</p>
              <div className="flex justify-center">
                {aDecl ? <StatusBadge status={aDecl.status} /> : <span className="text-xs text-muted-foreground">—</span>}
              </div>
              <div className="flex justify-center">
                {bDecl ? <StatusBadge status={bDecl.status} /> : <span className="text-xs text-muted-foreground">—</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Links to full compliance maps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href={`/compliance-map?product=${productA.id}`} className="card p-4 flex items-center justify-between hover:border-accent/50 transition-all group">
          <div>
            <p className="text-xs text-muted-foreground">View full compliance map</p>
            <p className="text-sm font-semibold text-navy">{productA.name}</p>
          </div>
          <ArrowRight size={16} className="text-muted-foreground group-hover:text-accent transition-colors" />
        </Link>
        <Link href={`/compliance-map?product=${productB.id}`} className="card p-4 flex items-center justify-between hover:border-accent/50 transition-all group">
          <div>
            <p className="text-xs text-muted-foreground">View full compliance map</p>
            <p className="text-sm font-semibold text-navy">{productB.name}</p>
          </div>
          <ArrowRight size={16} className="text-muted-foreground group-hover:text-accent transition-colors" />
        </Link>
      </div>
    </div>
  );
}
