'use client';

import React from 'react';
import { Volume2, Square } from 'lucide-react';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';

interface SpeakButtonProps {
  /** Stable id of the message this button reads — used to know which
   * button (if any) is the one currently speaking. */
  id: string;
  text: string;
  /** BCP-47 locale to speak in, e.g. "hi-IN". Falls back to the closest
   * available voice, or plain unvoiced text, if unavailable — see
   * useSpeechSynthesis. */
  speechLocale: string;
}

/** Renders nothing when speechSynthesis isn't supported at all, rather
 * than showing a button that can never work. */
export default function SpeakButton({ id, text, speechLocale }: SpeakButtonProps) {
  const { isSupported, speakingId, speak } = useSpeechSynthesis();
  const isSpeaking = speakingId === id;

  if (!isSupported) return null;

  return (
    <button
      type="button"
      onClick={() => speak(id, text, speechLocale)}
      aria-label={isSpeaking ? 'Stop speaking this answer' : 'Listen to this answer'}
      aria-pressed={isSpeaking}
      className={`inline-flex items-center justify-center w-6 h-6 rounded-md flex-shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
        isSpeaking ? 'text-accent' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {isSpeaking ? <Square size={12} /> : <Volume2 size={13} />}
    </button>
  );
}
