'use client';

import { useCallback, useEffect, useState } from 'react';

// `window.speechSynthesis` is a single global resource, so "which answer
// is currently speaking" is tracked at module scope and broadcast to every
// hook instance (every SpeakButton). This is what makes "stop if clicked
// again or if another answer is spoken" work correctly even though each
// AI message renders its own independent SpeakButton/hook instance.
let currentSpeakingId: string | null = null;
const listeners = new Set<(id: string | null) => void>();

const broadcast = (id: string | null) => {
  currentSpeakingId = id;
  listeners.forEach((listener) => listener(id));
};

const isSpeechSynthesisSupported = () =>
  typeof window !== 'undefined' &&
  'speechSynthesis' in window &&
  'SpeechSynthesisUtterance' in window;

const pickVoice = (lang: string): SpeechSynthesisVoice | undefined => {
  const voices = window.speechSynthesis.getVoices();
  const exact = voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase());
  if (exact) return exact;
  const base = lang.split('-')[0].toLowerCase();
  return voices.find((v) => v.lang.toLowerCase().startsWith(base));
};

export function useSpeechSynthesis() {
  const [speakingId, setSpeakingId] = useState<string | null>(currentSpeakingId);
  const isSupported = isSpeechSynthesisSupported();

  useEffect(() => {
    listeners.add(setSpeakingId);
    return () => {
      listeners.delete(setSpeakingId);
    };
  }, []);

  const stop = useCallback(() => {
    if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
    broadcast(null);
  }, []);

  /**
   * Speaks `text` in `lang` under the given stable `id` (message id).
   * Clicking the same id again stops it (toggle-off) instead of
   * restarting it. Starting any new speech first cancels whatever was
   * playing, satisfying "stop if another answer is spoken". Returns
   * false when speech synthesis isn't supported at all, so callers can
   * fall back to text-only without pretending voice worked.
   */
  const speak = useCallback((id: string, text: string, lang: string): boolean => {
    if (!isSpeechSynthesisSupported() || !text.trim()) return false;

    const wasSpeakingThis = currentSpeakingId === id;
    window.speechSynthesis.cancel();

    if (wasSpeakingThis) {
      broadcast(null);
      return true;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    // If no voice matches the requested language at all, speechSynthesis
    // still speaks with the browser's default voice/pronunciation rather
    // than failing — that's the "closest available" fallback; we never
    // claim native-quality output for it.
    const voice = pickVoice(lang);
    if (voice) utterance.voice = voice;

    utterance.onend = () => {
      if (currentSpeakingId === id) broadcast(null);
    };
    utterance.onerror = () => {
      if (currentSpeakingId === id) broadcast(null);
    };

    window.speechSynthesis.speak(utterance);
    broadcast(id);
    return true;
  }, []);

  return { isSupported, speakingId, speak, stop };
}
