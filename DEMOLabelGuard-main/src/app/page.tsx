import React from 'react';
import { Image as ImageIcon, Video, MessagesSquare, FileCheck2 } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import UploadZoneSection from './components/UploadZoneSection';
import DemoProductsSection from './components/DemoProductSection';
import HowItWorksSection from './components/HowItWorksSection';

const CAPABILITIES = [
  { id: 'photo-video', icon: ImageIcon, label: 'Photo & video scanning' },
  { id: 'multi-view', icon: Video, label: 'Multi-view analysis' },
  { id: 'copilot', icon: MessagesSquare, label: 'Ask LabelGuard Copilot' },
  { id: 'report', icon: FileCheck2, label: 'Evidence-backed reports' },
];

export default function ProductScanPage() {
  return (
    <AppLayout currentRoute="/">
      <div className="max-w-screen-xl mx-auto space-y-8 sm:space-y-10">
        {/* Page header */}
        <div className="text-center space-y-3 pt-2 sm:pt-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="text-xs font-semibold text-accent tracking-wide">
              AI Visual Compliance Copilot
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-navy tracking-tight leading-tight">
            See the label. <span className="text-accent">Understand the risk.</span>
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Upload a packaged product image below. LabelGuard AI extracts declarations, maps visual
            evidence, and delivers explainable compliance findings in seconds.
          </p>

          {/* Compact capability strip — real, existing features only */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {CAPABILITIES.map(({ id, icon: Icon, label }) => (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs font-medium text-muted-foreground"
              >
                <Icon size={12} className="text-accent flex-shrink-0" />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Main upload + demo section */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Upload zone — takes 3 cols, primary action */}
          <div className="xl:col-span-3">
            <UploadZoneSection />
          </div>
          {/* Demo products — takes 2 cols */}
          <div className="xl:col-span-2">
            <DemoProductsSection />
          </div>
        </div>

        {/* How it works */}
        <HowItWorksSection />
      </div>
    </AppLayout>
  );
}
