import React from 'react';
import AppLayout from '@/components/AppLayout';
import UploadZoneSection from './components/UploadZoneSection';
import DemoProductsSection from './components/DemoProductSection';
import HowItWorksSection from './components/HowItWorksSection';

export default function ProductScanPage() {
  return (
    <AppLayout currentRoute="/">
      <div className="max-w-screen-xl mx-auto space-y-10">
        {/* Page header */}
        <div className="text-center space-y-3 pt-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="text-xs font-semibold text-accent tracking-wide">AI Visual Compliance Copilot</span>
          </div>
          <h1 className="text-4xl font-extrabold text-navy tracking-tight">
            See the label.{' '}
            <span className="text-accent">Understand the risk.</span>
          </h1>
          <p className="text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Upload a packaged product image. AI extracts declarations, maps visual evidence,
            and delivers explainable compliance findings in seconds.
          </p>
        </div>

        {/* Main upload + demo section */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Upload zone — takes 3 cols */}
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
