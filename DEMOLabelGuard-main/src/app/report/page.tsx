import React from 'react';
import AppLayout from '@/components/AppLayout';
import ReportContent from './component/ReportContent';

export default function ReportPage() {
  return (
    <AppLayout currentRoute="/report">
      <ReportContent />
    </AppLayout>
  );
}
