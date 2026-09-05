'use client';

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Bot, CheckCircle2, Info, ShieldCheck } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { getProductById } from '@/lib/mockData';

function CopilotContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const productId = searchParams.get('product') || 'product-b-001';
  const findingId = searchParams.get('finding');
  const product = getProductById(productId);
  const declaration = product?.declarations.find((d) => d.id === findingId) || product?.declarations[0];
  const finding = declaration ? product?.findings.find((f) => f.declarationId === declaration.id) : undefined;

  if (!product || !declaration) {
    return (
      <AppLayout currentRoute="/">
        <div className="max-w-lg mx-auto py-20 text-center space-y-4">
          <Info size={48} className="text-review mx-auto" />
          <h1 className="text-xl font-bold text-navy">Finding unavailable</h1>
          <p className="text-sm text-muted-foreground">Run a demo inspection first to ask LabelGuard about a finding.</p>
          <button onClick={() => router.push('/')} className="btn-primary">Back to Scan</button>
        </div>
      </AppLayout>
    );
  }

  const statusClass = declaration.status === 'PASS' ? 'text-pass' : declaration.status === 'REVIEW' ? 'text-review' : 'text-flag';

  return (
    <AppLayout currentRoute="/">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="btn-ghost p-2 rounded-lg" aria-label="Go back"><ArrowLeft size={17} /></button>
          <div>
            <div className="flex items-center gap-2"><Bot size={20} className="text-accent" /><h1 className="text-2xl font-extrabold text-navy">Ask LabelGuard</h1></div>
            <p className="text-sm text-muted-foreground mt-1">Evidence-first explanation for {product.name}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="card p-5 md:col-span-1 space-y-4">
            <div><p className="section-label">Selected finding</p><h2 className="text-lg font-bold text-navy mt-1">{declaration.field}</h2><span className={`status-badge mt-2 inline-flex ${declaration.status === 'PASS' ? 'badge-pass' : declaration.status === 'REVIEW' ? 'badge-review' : 'badge-flag'}`}>{declaration.status}</span></div>
            <div className="p-3 rounded-xl bg-muted/50"><p className="text-xs text-muted-foreground">Detected text</p><p className="text-sm font-bold text-navy mt-1">{declaration.extractedText || 'Not detected'}</p></div>
            <div className="p-3 rounded-xl bg-muted/50"><p className="text-xs text-muted-foreground">Confidence</p><p className={`text-lg font-extrabold mt-1 ${statusClass}`}>{declaration.confidence}%</p></div>
          </div>

          <div className="card p-6 md:col-span-2 space-y-5">
            <div className="flex items-start gap-3"><div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0"><Bot size={20} className="text-accent" /></div><div><p className="font-bold text-navy">Why was this finding marked {declaration.status}?</p><p className="text-sm text-muted-foreground mt-1">LabelGuard explains the configured screening check using the evidence already mapped to the label.</p></div></div>
            <div className="p-4 rounded-xl border border-border bg-card space-y-3"><div className="flex items-center gap-2 text-sm font-semibold text-navy"><ShieldCheck size={16} className="text-accent" /> Compliance check</div><p className="text-sm text-muted-foreground">{declaration.ruleCheck}</p></div>
            <div className="p-4 rounded-xl bg-muted/50 space-y-2"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Explanation</p><p className="text-sm leading-relaxed text-foreground">{finding?.explanation || declaration.explanation}</p></div>
            <div className="p-4 rounded-xl border border-accent/20 bg-accent/5 space-y-2"><p className="text-xs font-bold uppercase tracking-wide text-accent">Recommended verification</p><p className="text-sm leading-relaxed text-navy">{finding?.recommendation || declaration.recommendedAction}</p></div>
            <div className="flex items-start gap-2 text-xs text-muted-foreground"><CheckCircle2 size={14} className="text-pass mt-0.5 flex-shrink-0" /><span>AI-assisted screening support only. An authorized official should make the final compliance determination.</span></div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}


export default function CopilotPage() {
  return (
    <Suspense fallback={<AppLayout currentRoute="/"><div className="max-w-lg mx-auto py-20 text-center text-sm text-muted-foreground">Loading LabelGuard…</div></AppLayout>}>
      <CopilotContent />
    </Suspense>
  );
}
