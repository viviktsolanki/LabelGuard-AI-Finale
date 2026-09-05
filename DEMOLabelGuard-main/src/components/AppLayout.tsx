import React from 'react';
import TopNav from './TopNav';

interface AppLayoutProps {
  children: React.ReactNode;
  currentRoute?: string;
}

export default function AppLayout({ children, currentRoute }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNav currentRoute={currentRoute} />
      <main className="flex-1 w-full max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-12 2xl:px-16 py-8">
        {children}
      </main>
    </div>
  );
}
