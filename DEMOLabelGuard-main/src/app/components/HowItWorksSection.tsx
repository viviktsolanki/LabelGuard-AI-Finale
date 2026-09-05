import React from 'react';
import { Upload, Brain, Shield, ArrowRight } from 'lucide-react';

const STEPS = [
  {
    id: 'step-scan',
    icon: <Upload size={22} />,
    step: '01',
    title: 'Scan',
    description: 'Upload a packaged product photo. Supports drag-and-drop, file browse, or mobile camera capture.',
    color: 'bg-blue-50 text-accent border-blue-100',
  },
  {
    id: 'step-understand',
    icon: <Brain size={22} />,
    step: '02',
    title: 'Understand',
    description: 'AI extracts and spatially maps every declaration — product name, MRP, manufacturer, dates, and more.',
    color: 'bg-purple-50 text-purple-600 border-purple-100',
  },
  {
    id: 'step-explain',
    icon: <Shield size={22} />,
    step: '03',
    title: 'Explain',
    description: 'Evidence-backed findings show exactly which rule was checked, where on the label, and why it was flagged.',
    color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  },
];

export default function HowItWorksSection() {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="section-label">How it works</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STEPS?.map((step, index) => (
          <div key={step?.id} className="relative">
            <div className="card p-5 h-full">
              <div className="flex items-start gap-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center border flex-shrink-0 ${step?.color}`}>
                  {step?.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-muted-foreground/50 font-tabular">
                      {step?.step}
                    </span>
                    <h3 className="text-base font-bold text-navy">{step?.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {step?.description}
                  </p>
                </div>
              </div>
            </div>

            {index < STEPS?.length - 1 && (
              <div className="hidden md:flex absolute top-1/2 -right-2 -translate-y-1/2 z-10 w-4 h-4 items-center justify-center bg-background">
                <ArrowRight size={14} className="text-muted-foreground/40" />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            AI/ML extraction
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            Computer vision
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Deterministic rule engine
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Human-in-the-loop review
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Explainable findings
          </span>
        </div>
      </div>
    </div>
  );
}
