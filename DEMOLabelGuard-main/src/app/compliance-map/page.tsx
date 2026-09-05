import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import ComplianceMapContent from './components/ComplianceMapContent';

export default function ComplianceMapPage() {
  return (
    <AppLayout currentRoute="/compliance-map">
      <Suspense fallback={<ComplianceMapFallback />}>
        <ComplianceMapContent />
      </Suspense>
    </AppLayout>
  );
}

function ComplianceMapFallback() {
  return (
    <div className="max-w-screen-xl mx-auto">
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3 space-y-4">
          <div className="animate-pulse bg-muted rounded-2xl h-[600px]" />
        </div>
        <div className="xl:col-span-2 space-y-4">
          <div className="animate-pulse bg-muted rounded-2xl h-40" />
          <div className="animate-pulse bg-muted rounded-2xl h-80" />
          <div className="animate-pulse bg-muted rounded-2xl h-60" />
        </div>
      </div>
    </div>
  );
}
