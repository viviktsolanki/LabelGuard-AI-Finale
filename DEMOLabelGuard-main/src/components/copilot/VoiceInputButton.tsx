'use client';

import React from 'react';
import { Mic, Square } from 'lucide-react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

interface VoiceInputButtonProps {
  /** BCP-47 locale for the currently selected language, e.g. "hi-IN". */
  speechLocale: string;
  /** Recognized speech is inserted into the caller's text input, never
   * sent automatically — the user reviews/edits, then submits normally. */
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

/**
 * Touch-friendly mic button shared by both Copilot entry points. Handles
 * unsupported browsers, permission errors, and language-support gaps
 * honestly via useSpeechRecognition's error state — never fakes support.
 */
export default function VoiceInputButton({
  speechLocale,
  onTranscript,
  disabled,
}: VoiceInputButtonProps) {
  const { isSupported, listening, error, start, stop } = useSpeechRecognition({
    lang: speechLocale,
    onResult: onTranscript,
  });

  if (!isSupported) {
    return (
      <button
        type="button"
        disabled
        aria-label="Voice input is not supported in this browser"
        title="Voice input is not supported in this browser. You can still type your question."
        className="btn-ghost p-3 rounded-xl flex-shrink-0 opacity-40 cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <Mic size={16} />
      </button>
    );
  }

  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => (listening ? stop() : start())}
        disabled={disabled}
        aria-label={listening ? 'Stop voice input' : 'Start voice input'}
        aria-pressed={listening}
        className={`p-3 rounded-xl transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
          listening ? 'bg-flag text-white animate-pulse' : 'btn-secondary'
        }`}
      >
        {listening ? <Square size={16} /> : <Mic size={16} />}
      </button>
      {listening && (
        <span className="sr-only" role="status">
          Listening for your question
        </span>
      )}
      {error && (
        <p
          role="alert"
          className="absolute bottom-full right-0 mb-1.5 w-48 max-w-[calc(100vw-2rem)] text-[11px] leading-snug text-flag bg-flag-bg border border-flag-border rounded-lg px-2 py-1.5 shadow-card z-10"
        >
          {error}
        </p>
      )}
    </div>
  );
}
