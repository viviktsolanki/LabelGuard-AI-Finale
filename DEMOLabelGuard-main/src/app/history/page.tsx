import React from 'react';
import AppLayout from '@/components/AppLayout';
import HistoryContent from './components/HistoryContent';

export default function HistoryPage() {
  return (
    <AppLayout currentRoute="/history">
      <HistoryContent />
    </AppLayout>
  );
}
