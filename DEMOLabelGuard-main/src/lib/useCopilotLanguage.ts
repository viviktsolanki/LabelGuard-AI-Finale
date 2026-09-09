'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_LANGUAGE_CODE,
  isSupportedLanguageCode,
  LANGUAGE_STORAGE_KEY,
  type LanguageCode,
} from '@/lib/languages';

const hasWindow = () => typeof window !== 'undefined';

const readStoredLanguage = (): LanguageCode => {
  if (!hasWindow()) return DEFAULT_LANGUAGE_CODE;
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isSupportedLanguageCode(stored) ? stored : DEFAULT_LANGUAGE_CODE;
  } catch {
    return DEFAULT_LANGUAGE_CODE;
  }
};

const writeStoredLanguage = (code: LanguageCode) => {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
  } catch {
    // Storage can be unavailable (private browsing, quota) — the chosen
    // language still works for the current session, it just won't
    // persist to the next visit.
  }
};

/**
 * Shared, hydration-safe language selection used by both Copilot entry
 * points (/copilot and the Scan Copilot widget) so the same language
 * choice follows the user between them and across reloads.
 *
 * Same mounted-gate pattern as the Copilot page's product lookup and the
 * Story Mode provider (see copilot/page.tsx, StoryModeProvider.tsx):
 * `language` starts at the fixed default on both the server render and
 * the client's first render, so that first render is guaranteed
 * identical. Only after the client has committed does the effect below
 * read localStorage and let the UI reflect a previously chosen language —
 * this must never happen during the render that produces the first
 * paint, or server/client output would diverge.
 */
export function useCopilotLanguage() {
  const [mounted, setMounted] = useState(false);
  const [language, setLanguageState] = useState<LanguageCode>(DEFAULT_LANGUAGE_CODE);

  useEffect(() => {
    setMounted(true);
    setLanguageState(readStoredLanguage());
  }, []);

  const setLanguage = useCallback((code: LanguageCode) => {
    setLanguageState(code);
    writeStoredLanguage(code);
  }, []);

  return { mounted, language, setLanguage };
}
