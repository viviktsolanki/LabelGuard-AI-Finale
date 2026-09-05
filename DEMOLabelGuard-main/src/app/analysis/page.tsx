import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import AnalysisContent from './components/AnalysisContent';

export default function AnalysisPage() {
  return (
    <AppLayout currentRoute="/analysis">
      <Suspense fallback={<AnalysisFallback />}>
        <AnalysisContent />
      </Suspense>
    </AppLayout>
  );
}

function AnalysisFallback() {
  return (
    <div className="max-w-2xl mx-auto py-20 text-center space-y-4">
      <div className="w-12 h-12 border-4 border-accent/20 border-t-accent rounded-full animate-spin mx-auto" />
      <p className="text-muted-foreground text-sm">Loading analysis...</p>
    </div>
  );
}
