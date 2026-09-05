import React from 'react';
import AppLayout from '@/components/AppLayout';
import CompareContent from './components/CompareContent';

export default function ComparePage() {
  return (
    <AppLayout currentRoute="/compare">
      <CompareContent />
    </AppLayout>
  );
}
