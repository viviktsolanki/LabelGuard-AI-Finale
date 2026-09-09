'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { STORY_STEPS, TOTAL_STORY_STEPS } from '@/lib/storyMode';

type StoryStatus = 'idle' | 'playing' | 'paused' | 'finished';

interface StoryModeState {
  /** True only after the client has committed its first render — see the
   * hydration note below. Nothing storage-dependent should be read before
   * this flips true. */
  mounted: boolean;
  status: StoryStatus;
  stepIndex: number;
  /** Widget is minimized to the compact "▶ Demo" pill. */
  minimized: boolean;
  /** Has the user ever started the demo in this browser. */
  hasSeenDemo: boolean;
  step: (typeof STORY_STEPS)[number];
  totalSteps: number;
}

interface StoryModeActions {
  start: () => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  previous: () => void;
  skip: () => void;
  exit: () => void;
  replay: () => void;
  minimize: () => void;
  expand: () => void;
}

type StoryModeContextValue = StoryModeState & StoryModeActions;

const StoryModeContext = createContext<StoryModeContextValue | null>(null);

// Two different persistence lifetimes, matching the two different asks:
// "remember minimized state during the session" (sessionStorage) vs
// "don't aggressively re-show the expanded widget" once the demo has been
// seen (localStorage, persists across visits). Both are namespaced under
// the same `labelguard:` prefix the rest of the app already uses for
// client-only storage (see src/lib/realProduct.ts).
const SEEN_KEY = 'labelguard:story-mode:seen';
const MINIMIZED_KEY = 'labelguard:story-mode:minimized';

const hasWindow = () => typeof window !== 'undefined';

const readSeen = (): boolean => {
  if (!hasWindow()) return false;
  try {
    return window.localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
};

const writeSeen = () => {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Storage can be unavailable (private browsing, quota) — Story Mode
    // still works within the session, it just won't remember next visit.
  }
};

const readMinimized = (): boolean => {
  if (!hasWindow()) return false;
  try {
    return window.sessionStorage.getItem(MINIMIZED_KEY) === '1';
  } catch {
    return false;
  }
};

const writeMinimized = (value: boolean) => {
  if (!hasWindow()) return;
  try {
    window.sessionStorage.setItem(MINIMIZED_KEY, value ? '1' : '0');
  } catch {
    // Same non-fatal storage failure as above.
  }
};

export function StoryModeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // Same mounted-gate pattern already used by the Copilot page (see
  // src/app/copilot/page.tsx) to avoid an SSR/client hydration mismatch:
  // `mounted` starts false on both server and client, so the very first
  // render is identical everywhere. Only after that first commit do we
  // read localStorage/sessionStorage and let the widget reflect real
  // persisted state. Do NOT read storage above this gate.
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<StoryStatus>('idle');
  const [stepIndex, setStepIndex] = useState(0);
  const [minimized, setMinimized] = useState(false);
  const [hasSeenDemo, setHasSeenDemo] = useState(false);

  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPushedRoute = useRef<string | null>(null);

  useEffect(() => {
    setMounted(true);
    setMinimized(readMinimized());
    setHasSeenDemo(readSeen());
  }, []);

  const clearTimer = useCallback(() => {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
  }, []);

  const step = STORY_STEPS[stepIndex] ?? STORY_STEPS[0];

  // Drive navigation from the current step. Guarded so we only push when
  // the step actually names a route and it differs from what we last
  // pushed for THIS step transition (avoids re-pushing on unrelated
  // re-renders while still allowing the user to freely navigate the real
  // app while paused/exited).
  useEffect(() => {
    if (status !== 'playing' && status !== 'paused') return;
    if (!step.route) return;
    if (lastPushedRoute.current === step.route) return;
    lastPushedRoute.current = step.route;
    router.push(step.route);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, stepIndex]);

  const goTo = useCallback(
    (index: number) => {
      clearTimer();
      const clamped = Math.max(0, Math.min(index, TOTAL_STORY_STEPS - 1));
      setStepIndex(clamped);
      lastPushedRoute.current = null;
      if (STORY_STEPS[clamped]?.kind === 'finish') {
        setStatus('finished');
      }
    },
    [clearTimer]
  );

  const start = useCallback(() => {
    writeSeen();
    setHasSeenDemo(true);
    setMinimized(false);
    writeMinimized(false);
    lastPushedRoute.current = null;
    setStepIndex(0);
    setStatus('playing');
  }, []);

  const pause = useCallback(() => {
    clearTimer();
    setStatus((s) => (s === 'playing' ? 'paused' : s));
  }, [clearTimer]);

  const resume = useCallback(() => {
    setStatus((s) => (s === 'paused' ? 'playing' : s));
  }, []);

  const next = useCallback(() => {
    goTo(stepIndex + 1);
    setStatus((s) => (s === 'finished' ? s : 'playing'));
  }, [goTo, stepIndex]);

  const previous = useCallback(() => {
    goTo(stepIndex - 1);
    setStatus('playing');
  }, [goTo, stepIndex]);

  const skip = useCallback(() => {
    clearTimer();
    setStatus('idle');
    setMinimized(true);
    writeMinimized(true);
  }, [clearTimer]);

  const exit = useCallback(() => {
    clearTimer();
    setStatus('idle');
    setMinimized(true);
    writeMinimized(true);
  }, [clearTimer]);

  const replay = useCallback(() => {
    start();
  }, [start]);

  const minimize = useCallback(() => {
    setMinimized(true);
    writeMinimized(true);
  }, []);

  const expand = useCallback(() => {
    setMinimized(false);
    writeMinimized(false);
  }, []);

  // Autoplay: while playing (not paused), auto-advance after the current
  // step's duration. Cleared on every dependency change, so pausing,
  // manual next/previous, or unmount all reliably stop the pending timer.
  useEffect(() => {
    clearTimer();
    if (status !== 'playing') return undefined;
    if (step.kind === 'finish') return undefined;

    advanceTimer.current = setTimeout(() => {
      goTo(stepIndex + 1);
    }, step.durationMs);

    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, stepIndex]);

  // Escape exits the walkthrough (never traps focus/keyboard input).
  useEffect(() => {
    if (status !== 'playing' && status !== 'paused') return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exit();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [status, exit]);

  // If the user navigates the real app themselves mid-walkthrough (e.g.
  // clicks a nav link), stop treating our own last-pushed route as
  // authoritative so a subsequent Next doesn't get swallowed as a no-op.
  useEffect(() => {
    if (pathname && step.route && !step.route.startsWith(pathname)) {
      // pathname changed independently of a story-mode push; nothing to
      // do here beyond letting the effect above push again next step.
    }
  }, [pathname, step.route]);

  const value = useMemo<StoryModeContextValue>(
    () => ({
      mounted,
      status,
      stepIndex,
      minimized,
      hasSeenDemo,
      step,
      totalSteps: TOTAL_STORY_STEPS,
      start,
      pause,
      resume,
      next,
      previous,
      skip,
      exit,
      replay,
      minimize,
      expand,
    }),
    [
      mounted,
      status,
      stepIndex,
      minimized,
      hasSeenDemo,
      step,
      start,
      pause,
      resume,
      next,
      previous,
      skip,
      exit,
      replay,
      minimize,
      expand,
    ]
  );

  return <StoryModeContext.Provider value={value}>{children}</StoryModeContext.Provider>;
}

export function useStoryMode(): StoryModeContextValue {
  const ctx = useContext(StoryModeContext);
  if (!ctx) {
    throw new Error('useStoryMode must be used within a StoryModeProvider');
  }
  return ctx;
}
