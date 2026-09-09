'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Bot, Loader2, RotateCcw, Send, User } from 'lucide-react';
import type { ChatMessage } from '@/lib/useAskLabelGuard';
import { getLanguage, type LanguageCode } from '@/lib/languages';
import LanguageSelector from './LanguageSelector';
import VoiceInputButton from './VoiceInputButton';
import SpeakButton from './SpeakButton';

interface CopilotChatPanelProps {
  messages: ChatMessage[];
  loading: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSend: (text: string) => void;
  suggestions: string[];
  placeholder: string;
  emptyStateText: string;
  language: LanguageCode;
  onLanguageChange: (code: LanguageCode) => void;
  /** Slightly tighter spacing for the small floating widget vs the full
   * /copilot page. */
  compact?: boolean;
}

/**
 * The entire message list + suggestions + input row, including voice
 * input, spoken answers, and the language selector. Used by BOTH
 * /copilot and the Scan Copilot widget (see ScanCopilotWidget.tsx) so
 * there is exactly one implementation of the chat UI — callers only
 * supply state (from useAskLabelGuard) and page-specific copy
 * (suggestions, placeholder, empty-state text).
 */
export default function CopilotChatPanel({
  messages,
  loading,
  input,
  onInputChange,
  onSend,
  suggestions,
  placeholder,
  emptyStateText,
  language,
  onLanguageChange,
  compact = false,
}: CopilotChatPanelProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const activeLanguage = getLanguage(language);
  const dir = activeLanguage.rtl ? 'rtl' : 'ltr';

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSend(input);
  };

  const handleTranscript = (transcript: string) => {
    onInputChange(input.trim() ? `${input.trim()} ${transcript}` : transcript);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-end gap-2 mb-2.5 flex-shrink-0">
        <LanguageSelector value={language} onChange={onLanguageChange} />
      </div>

      {/* Conversation. RTL is applied only to individual message/input
          text (Part 9) — the surrounding chrome (buttons, this panel's
          own layout) stays LTR so controls never become inaccessible. */}
      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Conversation with Ask LabelGuard"
        className={`card flex-1 overflow-y-auto p-4 space-y-4 mb-3 min-h-0 ${compact ? 'text-sm' : ''}`}
      >
        {messages.length === 0 && !loading && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3 py-6 px-2">
            <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center">
              <Bot size={compact ? 22 : 26} className="text-accent" />
            </div>
            <p className="text-sm font-semibold text-navy">Ask LabelGuard</p>
            <p className="text-sm text-muted-foreground max-w-sm">{emptyStateText}</p>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.role === 'assistant' && (
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                <Bot size={16} className="text-accent" />
              </div>
            )}
            <div
              className={`max-w-[80%] min-w-0 rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : m.isError
                    ? 'bg-flag-bg border border-flag-border text-flag'
                    : 'bg-muted/60 text-foreground'
              }`}
            >
              {m.role === 'assistant' && !m.isError && (
                <div className="flex justify-end -mt-1 -mr-1 mb-0.5">
                  <SpeakButton
                    id={m.id}
                    text={m.content}
                    speechLocale={activeLanguage.speechLocale}
                  />
                </div>
              )}
              <span className="sr-only">
                {m.role === 'user' ? 'You said: ' : 'LabelGuard replied: '}
              </span>
              <p dir={dir} className="whitespace-pre-wrap break-words">
                {m.content}
              </p>
              {m.isError && m.retryQuestion && (
                <button
                  type="button"
                  onClick={() => onSend(m.retryQuestion as string)}
                  disabled={loading}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-flag hover:underline disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded"
                >
                  <RotateCcw size={12} /> Retry
                </button>
              )}
              {m.navAction && (
                <div className="mt-2">
                  <Link
                    href={m.navAction.href}
                    className="btn-primary text-xs px-3 py-1.5 rounded-lg inline-flex"
                  >
                    Open {m.navAction.label}
                  </Link>
                </div>
              )}
            </div>
            {m.role === 'user' && (
              <div className="w-8 h-8 rounded-lg bg-navy/10 flex items-center justify-center flex-shrink-0">
                <User size={16} className="text-navy" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-2.5 justify-start" aria-hidden="true">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Bot size={16} className="text-accent" />
            </div>
            <div className="rounded-2xl px-4 py-2.5 bg-muted/60 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" /> Thinking…
            </div>
          </div>
        )}
        {loading && (
          <span className="sr-only" role="status">
            Ask LabelGuard is thinking
          </span>
        )}
      </div>

      {messages.length === 0 && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3 flex-shrink-0">
          <span className="sr-only" id="copilot-suggestions-label">
            Suggested questions
          </span>
          {suggestions.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onSend(q)}
              disabled={loading}
              aria-describedby="copilot-suggestions-label"
              className="btn-secondary text-xs px-3 py-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2 flex-shrink-0">
        <textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend(input);
            }
          }}
          placeholder={placeholder}
          aria-label="Your question for Ask LabelGuard"
          rows={1}
          dir={dir}
          className="flex-1 min-w-0 resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 max-h-32"
        />
        <VoiceInputButton
          speechLocale={activeLanguage.speechLocale}
          onTranscript={handleTranscript}
          disabled={loading}
        />
        <button
          type="submit"
          className="btn-primary px-4 py-3 rounded-xl flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2"
          disabled={loading || !input.trim()}
          aria-label="Send"
        >
          <Send size={16} />
        </button>
      </form>
      <p className="text-xs text-muted-foreground/70 text-center mt-2 flex-shrink-0">
        AI-assisted screening support only. An authorized official should make the final compliance
        determination.
      </p>
    </div>
  );
}
