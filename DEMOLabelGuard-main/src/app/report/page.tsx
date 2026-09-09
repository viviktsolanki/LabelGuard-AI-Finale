import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import ReportContent from './component/ReportContent';

export default function ReportPage() {
  return (
    <AppLayout currentRoute="/report">
      <Suspense fallback={<ReportFallback />}>
        <ReportContent />
      </Suspense>
    </AppLayout>
  );
}

function ReportFallback() {
  return (
    <div className="max-w-screen-lg mx-auto space-y-6">
      <div className="animate-pulse bg-muted rounded-2xl h-20" />
      <div className="animate-pulse bg-muted rounded-2xl h-48" />
      <div className="animate-pulse bg-muted rounded-2xl h-96" />
    </div>
  );
}
