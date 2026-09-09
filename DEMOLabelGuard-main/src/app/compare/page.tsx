import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import CompareContent from './components/CompareContent';

export default function ComparePage() {
  return (
    <AppLayout currentRoute="/compare">
      <Suspense fallback={<CompareFallback />}>
        <CompareContent />
      </Suspense>
    </AppLayout>
  );
}

function CompareFallback() {
  return (
    <div className="max-w-screen-xl mx-auto space-y-6">
      <div className="animate-pulse bg-muted rounded-2xl h-24" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="animate-pulse bg-muted rounded-2xl h-40" />
        <div className="animate-pulse bg-muted rounded-2xl h-40" />
      </div>
    </div>
  );
}
