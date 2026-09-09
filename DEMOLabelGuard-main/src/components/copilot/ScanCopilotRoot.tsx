'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import ScanCopilotWidget from './ScanCopilotWidget';

/**
 * Mounted once in src/app/layout.tsx, alongside StoryModeRoot — kept as
 * its own small client component for the same reason StoryModeRoot is:
 * so the root layout itself (metadata, fonts) can stay a server
 * component.
 *
 * Restricted to the scan/homepage ("/") only. The full Ask LabelGuard
 * experience already lives at /copilot and is reachable from every page;
 * this second entry point exists specifically for users who are confused
 * before or during a scan, so it only needs to appear where that
 * confusion happens.
 */
export default function ScanCopilotRoot() {
  const pathname = usePathname();
  if (pathname !== '/') return null;
  return <ScanCopilotWidget />;
}
