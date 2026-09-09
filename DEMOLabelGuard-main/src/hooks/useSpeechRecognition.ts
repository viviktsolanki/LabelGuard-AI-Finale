'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Minimal shape of the browser SpeechRecognition API — not in standard
// TS DOM lib, and support is still vendor-prefixed in some browsers, so
// this is typed loosely on purpose rather than pulling in a dependency.
interface SpeechRecognitionResultLike {
  transcript: string;
}
interface SpeechRecognitionEventLike {
  results: { [index: number]: { [index: number]: SpeechRecognitionResultLike } };
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

const getSpeechRecognitionCtor = (): SpeechRecognitionCtor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

const UNSUPPORTED_MESSAGE =
  'Voice input is not supported in your current browser. You can still type your question.';
const LANGUAGE_UNSUPPORTED_MESSAGE =
  'Voice input is not supported for this language in your current browser. You can still type your question.';
const PERMISSION_DENIED_MESSAGE =
  'Microphone access was denied. Allow microphone access in your browser to use voice input, or type your question instead.';
const GENERIC_ERROR_MESSAGE = 'Voice input ran into a problem. You can still type your question.';

export interface UseSpeechRecognitionOptions {
  /** BCP-47 locale to request recognition in, e.g. "hi-IN". */
  lang: string;
  /** Called once with the final recognized transcript. Never auto-sent —
   * callers must let the user review/edit before submitting. */
  onResult: (transcript: string) => void;
}

export function useSpeechRecognition({ lang, onResult }: UseSpeechRecognitionOptions) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const isSupported = useMemo(() => getSpeechRecognitionCtor() !== null, []);

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // Already stopped/never started — nothing to do.
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError(UNSUPPORTED_MESSAGE);
      return;
    }

    setError(null);

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) onResultRef.current(transcript);
    };

    recognition.onerror = (event) => {
      switch (event.error) {
        case 'not-allowed':
        case 'permission-denied':
        case 'service-not-allowed':
          setError(PERMISSION_DENIED_MESSAGE);
          break;
        case 'language-not-supported':
          setError(LANGUAGE_UNSUPPORTED_MESSAGE);
          break;
        case 'no-speech':
          // Not an error worth surfacing — user just didn't say anything.
          break;
        case 'aborted':
          break;
        default:
          setError(GENERIC_ERROR_MESSAGE);
      }
      setListening(false);
    };

    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setListening(true);
    } catch {
      setError(GENERIC_ERROR_MESSAGE);
      setListening(false);
    }
  }, [lang]);

  // Stop any in-flight recognition on unmount (panel closed, navigated
  // away) rather than leaving the microphone open.
  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        // Nothing to clean up.
      }
    };
  }, []);

  return { isSupported, listening, error, start, stop };
}
