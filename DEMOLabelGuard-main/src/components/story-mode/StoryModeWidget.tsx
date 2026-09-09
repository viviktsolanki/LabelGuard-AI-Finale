'use client';

import React from 'react';
import { Play, Minus, Sparkles } from 'lucide-react';
import { useStoryMode } from './StoryModeProvider';

/**
 * Bottom-LEFT floating widget. Only rendered when Story Mode is idle or
 * finished — while playing/paused, StoryModeOverlay takes over instead.
 *
 * Positioned bottom-left rather than bottom-right: the app's existing
 * <Toaster position="bottom-right" /> (src/app/layout.tsx) anchors toast
 * notifications to that same corner, and VideoScanPanel / UploadZoneSection
 * both fire toasts from the homepage this widget lives on — the same page
 * Story Mode's own "select-demo" step is shown on. Sharing the corner
 * risks the toast stack visually overlapping this widget. Bottom-left is
 * unused by anything else in the app, so this avoids the collision without
 * touching Toaster's config or any other unrelated file.
 *
 * Hydration safety: renders nothing until `mounted` is true (see
 * StoryModeProvider), so the server render and the client's first render
 * are both empty here — identical to how the Copilot page avoids a
 * hydration mismatch around localStorage-backed state.
 */
export default function StoryModeWidget() {
  const { mounted, status, minimized, hasSeenDemo, start, minimize, expand } = useStoryMode();

  if (!mounted) return null;
  if (status === 'playing' || status === 'paused') return null;

  if (minimized) {
    return (
      <button
        type="button"
        onClick={expand}
        aria-label="Open LabelGuard demo widget"
        className="fixed bottom-5 left-5 z-40 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-3 shadow-card-hover hover:opacity-90 active:scale-95 transition-all duration-150 animate-fade-in-up"
      >
        <Play size={14} fill="currentColor" />
        <span className="text-sm font-semibold">Demo</span>
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="LabelGuard guided demo"
      className="fixed bottom-5 left-5 z-40 w-[280px] max-w-[calc(100vw-2.5rem)] card p-4 shadow-card-hover animate-fade-in-up"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-accent">
          <Sparkles size={16} />
          <span className="text-xs font-bold tracking-wide uppercase">
            {hasSeenDemo ? 'Watch again' : 'New to LabelGuard?'}
          </span>
        </div>
        <button
          type="button"
          onClick={minimize}
          aria-label="Minimize demo widget"
          className="btn-ghost p-1 rounded-md -mt-1 -mr-1"
        >
          <Minus size={15} />
        </button>
      </div>

      <p className="text-sm text-navy font-semibold leading-snug mb-1">
        See how LabelGuard works in under a minute.
      </p>
      <p className="text-xs text-muted-foreground leading-relaxed mb-3">
        A guided walkthrough using a real demo product — no clicking required.
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={start}
          className="btn-primary text-xs px-4 py-2 rounded-lg flex-1"
        >
          <Play size={13} fill="currentColor" />
          Play Demo
        </button>
        <button
          type="button"
          onClick={minimize}
          className="btn-secondary text-xs px-3 py-2 rounded-lg"
        >
          Minimize
        </button>
      </div>
    </div>
  );
}
