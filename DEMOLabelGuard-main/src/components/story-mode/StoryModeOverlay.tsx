'use client';

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Sparkles,
  X,
} from 'lucide-react';
import { useStoryMode } from './StoryModeProvider';
import { STORY_STAGES } from '@/lib/storyMode';

/**
 * Narration bar + controls, shown only while Story Mode is actively
 * playing or paused. Deliberately NOT a full-screen dimmed modal: it sits
 * as a slim bar so the real app underneath stays fully visible and
 * interactive, per the "don't block important UI" / "don't trap the
 * user" requirements. A visible control (Pause/Skip/Exit) is always on
 * screen, and Escape exits from anywhere (wired in StoryModeProvider).
 *
 * Positioned bottom-left (see StoryModeWidget.tsx for why) to avoid
 * overlapping the app's existing bottom-right Sonner <Toaster />.
 */
export default function StoryModeOverlay() {
  const router = useRouter();
  const {
    mounted,
    status,
    step,
    stepIndex,
    totalSteps,
    pause,
    resume,
    next,
    previous,
    skip,
    exit,
    replay,
  } = useStoryMode();

  const dialogRef = useRef<HTMLDivElement>(null);

  // Move focus onto the narration/finish panel whenever a new step (or
  // the finish screen) appears, so keyboard/screen-reader users tracking
  // the walkthrough always land somewhere sensible instead of focus
  // staying on a control that may have just disappeared (e.g. the
  // widget's "Play Demo" button after `start()`, or an overlay button
  // that only exists on some steps).
  useEffect(() => {
    if (status === 'playing' || status === 'paused') {
      dialogRef.current?.focus();
    }
  }, [status, stepIndex]);

  if (!mounted) return null;
  if (status !== 'playing' && status !== 'paused') return null;

  if (step.kind === 'finish') {
    return (
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-label="Demo finished"
        className="fixed bottom-5 left-5 z-40 w-[300px] max-w-[calc(100vw-2.5rem)] card p-5 shadow-card-hover animate-bounce-in focus:outline-none"
      >
        <div className="flex items-center gap-2 text-accent mb-2">
          <Sparkles size={16} />
          <span className="text-xs font-bold tracking-wide uppercase">Demo complete</span>
        </div>
        <p className="text-sm font-bold text-navy leading-snug mb-1">
          You&rsquo;ve seen LabelGuard in action.
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed mb-4">
          See the label. Understand the risk. Take action.
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              exit();
              router.push('/');
            }}
            className="btn-primary text-xs px-4 py-2 rounded-lg w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2"
          >
            Try It Yourself
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={replay}
              className="btn-secondary text-xs px-3 py-2 rounded-lg flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <RotateCcw size={13} />
              Replay Demo
            </button>
            <button
              type="button"
              onClick={exit}
              className="btn-ghost text-xs px-3 py-2 rounded-lg flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              aria-label="Exit demo"
            >
              Exit Demo
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isFirst = stepIndex === 0;
  // Last real (non-finish) step index.
  const isLastContentStep = stepIndex >= totalSteps - 2;
  const currentStageIndex = step.stage ? STORY_STAGES.findIndex((s) => s.key === step.stage) : -1;

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-label="LabelGuard guided demo narration"
      className="fixed inset-x-4 bottom-5 sm:inset-x-auto sm:left-5 sm:right-auto z-40 sm:w-[360px] max-w-[calc(100vw-2rem)] card p-4 shadow-card-hover animate-fade-in-up focus:outline-none"
    >
      {/* Narration */}
      <div className="flex items-start gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Sparkles size={14} className="text-accent" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-navy">{step.narrationTitle}</p>
          <p className="text-sm text-foreground leading-relaxed mt-0.5">{step.narration}</p>
        </div>
        <button
          type="button"
          onClick={exit}
          aria-label="Exit demo"
          className="btn-ghost p-1 rounded-md flex-shrink-0 -mt-1 -mr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <X size={15} />
        </button>
      </div>

      {/* Real-pipeline stage legend: Scan → Analyze → Evidence →
          Compliance → Report → Copilot. Purely a label of which real,
          existing page the current step demonstrates — never implies a
          separate demo-only flow. Completed stages get a checkmark (not
          just a color change) so this isn't a color-only indicator. */}
      {currentStageIndex >= 0 && (
        <div
          role="list"
          aria-label={`Demo stage ${currentStageIndex + 1} of ${STORY_STAGES.length}: ${STORY_STAGES[currentStageIndex].label}`}
          className="flex flex-wrap items-center gap-1 mb-3"
        >
          {STORY_STAGES.map((s, i) => {
            const state =
              i < currentStageIndex ? 'done' : i === currentStageIndex ? 'current' : 'upcoming';
            return (
              <span
                key={s.key}
                role="listitem"
                aria-current={state === 'current' ? 'step' : undefined}
                className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full ${
                  state === 'current'
                    ? 'bg-accent text-accent-foreground'
                    : state === 'done'
                      ? 'bg-accent/10 text-accent'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {state === 'done' && <Check size={10} />}
                {s.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Progress */}
      <div className="flex items-center gap-1.5 mb-3" aria-hidden="true">
        {Array.from({ length: totalSteps - 1 }).map((_, i) => (
          <div
            key={`story-progress-${i}`}
            className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
              i <= stepIndex ? 'bg-accent' : 'bg-muted'
            }`}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-1.5">
        <button
          type="button"
          onClick={previous}
          disabled={isFirst}
          aria-label="Previous step"
          className="btn-ghost p-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <ChevronLeft size={16} />
        </button>

        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
          Step {stepIndex + 1} of {totalSteps - 1}
        </span>

        {status === 'playing' ? (
          <button
            type="button"
            onClick={pause}
            aria-label="Pause demo"
            className="btn-ghost p-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <Pause size={16} />
          </button>
        ) : (
          <button
            type="button"
            onClick={resume}
            aria-label="Resume demo"
            className="btn-ghost p-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <Play size={16} fill="currentColor" />
          </button>
        )}

        <button
          type="button"
          onClick={next}
          aria-label={isLastContentStep ? 'Finish demo' : 'Next step'}
          className="btn-ghost p-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <ChevronRight size={16} />
        </button>

        <button
          type="button"
          onClick={skip}
          aria-label="Skip demo"
          className="btn-ghost p-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <SkipForward size={16} />
        </button>
      </div>
    </div>
  );
}
