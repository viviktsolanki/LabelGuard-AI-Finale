'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Bot, X } from 'lucide-react';
import CopilotChatPanel from './CopilotChatPanel';
import { useAskLabelGuard } from '@/lib/useAskLabelGuard';
import { useCopilotLanguage } from '@/lib/useCopilotLanguage';
import { getAllRealProducts } from '@/lib/realProduct';
import { buildProductContext, type CopilotProductContext } from '@/lib/copilotContext';
import type { ProductAnalysis } from '@/lib/mockData';

/** Session-only (not localStorage): re-opening the tab should start with
 * the widget collapsed again, same lifetime choice Story Mode uses for
 * its own minimized state. */
const OPEN_KEY = 'labelguard:scan-copilot:open';

const SCAN_SUGGESTIONS = [
  'How do I scan my product?',
  'Should I upload front and back?',
  'Can I upload a video?',
  'What happens after Analyze?',
];

const hasWindow = () => typeof window !== 'undefined';

const readOpen = (): boolean => {
  if (!hasWindow()) return false;
  try {
    return window.sessionStorage.getItem(OPEN_KEY) === '1';
  } catch {
    return false;
  }
};

const writeOpen = (value: boolean) => {
  if (!hasWindow()) return;
  try {
    window.sessionStorage.setItem(OPEN_KEY, value ? '1' : '0');
  } catch {
    // Non-fatal — the widget just won't remember open state next tab.
  }
};

/**
 * Second Ask LabelGuard entry point, for the scan/homepage. Shares the
 * exact same AI backend, language state, and chat panel as /copilot
 * (via useAskLabelGuard / useCopilotLanguage / CopilotChatPanel) — this
 * file only owns the floating widget chrome and its open/closed state.
 *
 * Positioned top-right, below the sticky TopNav (top-0, z-50): Story
 * Mode's widget already owns bottom-left and the Toaster owns
 * bottom-right (see StoryModeWidget.tsx), so top-right below the nav is
 * the one corner nothing else on this page uses.
 *
 * Hydration safety: same mounted-gate pattern as Story Mode / the
 * Copilot page — renders nothing until the client has committed its
 * first render, so server and first-client output match exactly.
 */
export default function ScanCopilotWidget() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const { language, setLanguage } = useCopilotLanguage();
  // Most recently saved real scan on this device, if any — read once on
  // mount (same hydration-safe, localStorage-after-mount pattern used
  // everywhere else here). Never a demo product, and never guessed: this
  // is only ever real data from getAllRealProducts, or null.
  const [recentProduct, setRecentProduct] = useState<ProductAnalysis | null>(null);

  const productContext = useMemo<CopilotProductContext | null>(
    () => (recentProduct ? buildProductContext(recentProduct, true) : null),
    [recentProduct]
  );

  const { messages, input, setInput, loading, sendToAssistant } = useAskLabelGuard({
    assistantMode: 'scan',
    productContext,
    productId: recentProduct?.id ?? null,
    language,
  });

  useEffect(() => {
    setMounted(true);
    setOpen(readOpen());
    try {
      const [latest] = getAllRealProducts();
      setRecentProduct(latest ?? null);
    } catch {
      setRecentProduct(null);
    }
  }, []);

  const toggleOpen = (next: boolean) => {
    setOpen(next);
    writeOpen(next);
  };

  if (!mounted) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => toggleOpen(true)}
        aria-label="Open Ask LabelGuard assistant"
        className="fixed top-20 right-4 sm:right-5 z-40 inline-flex items-center gap-2 rounded-full bg-accent text-accent-foreground px-4 py-3 shadow-card-hover hover:opacity-90 active:scale-95 transition-all duration-150 animate-fade-in-up focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2"
      >
        <Bot size={16} />
        <span className="text-sm font-semibold hidden sm:inline">Ask LabelGuard</span>
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Ask LabelGuard assistant"
      className="fixed top-20 right-4 sm:right-5 z-40 w-[340px] max-w-[calc(100vw-2rem)] h-[min(30rem,calc(100dvh-7rem))] card p-4 shadow-card-hover flex flex-col animate-fade-in-up"
    >
      <div className="flex items-center justify-between gap-2 mb-1 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Bot size={18} className="text-accent flex-shrink-0" />
          <span className="text-sm font-bold text-navy truncate">Ask LabelGuard</span>
        </div>
        <button
          type="button"
          onClick={() => toggleOpen(false)}
          aria-label="Minimize Ask LabelGuard assistant"
          className="btn-ghost p-1.5 rounded-md flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <X size={16} />
        </button>
      </div>

      {recentProduct && (
        <p className="text-xs text-muted-foreground truncate mb-2 flex-shrink-0">
          Can reference your last scan: <span className="font-medium">{recentProduct.name}</span>
        </p>
      )}

      <CopilotChatPanel
        messages={messages}
        loading={loading}
        input={input}
        onInputChange={setInput}
        onSend={sendToAssistant}
        suggestions={
          recentProduct
            ? [...SCAN_SUGGESTIONS, `What should I fix in ${recentProduct.name}?`]
            : SCAN_SUGGESTIONS
        }
        placeholder="Ask how to use LabelGuard…"
        emptyStateText={
          recentProduct
            ? `Ask how to scan a product, or about your last scan (${recentProduct.name}) — I only know real LabelGuard features and data.`
            : 'Ask how to scan a product, use video, or find your results — I only know real LabelGuard features.'
        }
        language={language}
        onLanguageChange={setLanguage}
        compact
      />
    </div>
  );
}
