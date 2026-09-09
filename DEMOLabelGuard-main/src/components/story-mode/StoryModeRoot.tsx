'use client';

import React from 'react';
import { StoryModeProvider } from './StoryModeProvider';
import StoryModeWidget from './StoryModeWidget';
import StoryModeOverlay from './StoryModeOverlay';

/**
 * Mounted once in src/app/layout.tsx, alongside the existing <Toaster />.
 * Kept as its own client component (rather than making layout.tsx itself
 * a client component) so the root layout — metadata, fonts, etc. — stays
 * a server component exactly as before.
 */
export default function StoryModeRoot() {
  return (
    <StoryModeProvider>
      <StoryModeWidget />
      <StoryModeOverlay />
    </StoryModeProvider>
  );
}
