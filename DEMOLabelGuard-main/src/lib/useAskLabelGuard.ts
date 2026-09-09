'use client';

import { useCallback, useState } from 'react';
import {
  detectNavigationIntent,
  type CopilotProductContext,
  type NavigationIntent,
} from '@/lib/copilotContext';
import type { LanguageCode } from '@/lib/languages';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isError?: boolean;
  navAction?: NavigationIntent | null;
  /** The original question text that produced this error, so the UI can
   * offer a one-tap "Retry" that resends exactly what was asked — never
   * shown on non-error messages. */
  retryQuestion?: string;
}

let idCounter = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${idCounter++}`;

/**
 * Distinguishes the full report/finding-aware Copilot from the general
 * scan/homepage assistant. Both send this to the SAME `/api/copilot`
 * route — it only changes how the system prompt frames the answer, never
 * which backend or AI provider is used (see route.ts).
 */
export type AssistantMode = 'copilot' | 'scan';

export interface UseAskLabelGuardOptions {
  assistantMode: AssistantMode;
  /** Structured product/report context, or null when no product is open
   * (e.g. general website questions, or the Scan Copilot before a scan
   * exists). Never images, never raw AI JSON — see copilotContext.ts. */
  productContext: CopilotProductContext | null;
  /** Used only for deterministic navigation links (e.g. "open my report"
   * keeps the current product id in the URL). */
  productId?: string | null;
  language: LanguageCode;
}

/**
 * Single shared implementation of "send a question to Ask LabelGuard and
 * track the conversation" — used by both the /copilot page and the Scan
 * Copilot widget so there is exactly one place that talks to the API,
 * one place that runs navigation-intent detection, and one message-list
 * shape. Do not re-implement this fetch/navigation logic elsewhere.
 */
export function useAskLabelGuard({
  assistantMode,
  productContext,
  productId,
  language,
}: UseAskLabelGuardOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendToAssistant = useCallback(
    async (rawQuestion: string) => {
      const question = rawQuestion.trim();
      if (!question || loading) return;

      const userMsg: ChatMessage = { id: nextId('u'), role: 'user', content: question };
      const historyForRequest = [...messages, userMsg];
      setMessages(historyForRequest);
      setInput('');

      // Deterministic, non-AI navigation for clear "take me to X" requests
      // — matched only against routes that actually exist, so it can
      // never send the user somewhere fake. Shared by both entry points.
      const navIntent = detectNavigationIntent(question, productId ?? null);
      if (navIntent) {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId('a'),
            role: 'assistant',
            content: `Here you go — opening ${navIntent.label}.`,
            navAction: navIntent,
          },
        ]);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch('/api/copilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: question,
            history: historyForRequest
              .slice(-10)
              .map((m) => ({ role: m.role, content: m.content })),
            productContext,
            language,
            assistantMode,
          }),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.success || typeof data.answer !== 'string') {
          throw new Error(
            (data && typeof data.error === 'string' && data.error) ||
              'Ask LabelGuard is temporarily unavailable. Please try again.'
          );
        }

        setMessages((prev) => [
          ...prev,
          { id: nextId('a'), role: 'assistant', content: data.answer },
        ]);
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId('e'),
            role: 'assistant',
            content:
              error instanceof Error
                ? error.message
                : 'Ask LabelGuard is temporarily unavailable. Please try again.',
            isError: true,
            retryQuestion: question,
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, productContext, productId, language, assistantMode]
  );

  return { messages, setMessages, input, setInput, loading, sendToAssistant };
}
