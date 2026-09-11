'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Bot, Info } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import CopilotChatPanel from '@/components/copilot/CopilotChatPanel';
import { isRealUploadId, resolveProductById } from '@/lib/realProduct';
import {
  buildProductContext,
  resolveFocusFinding,
  type CopilotProductContext,
} from '@/lib/copilotContext';
import { useAskLabelGuard } from '@/lib/useAskLabelGuard';
import { useCopilotLanguage } from '@/lib/useCopilotLanguage';

const PRODUCT_SUGGESTIONS = [
  'Why did my product get this result?',
  'What should I fix first?',
  'Summarize my report.',
  'What information is missing?',
];

const GENERAL_SUGGESTIONS = [
  'How do I scan a product?',
  'How do I use the Compliance Map?',
  'How do I compare products?',
  'How do I export a report?',
];

function CopilotContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // No fallback to a demo product id: a missing/unresolvable `?product=`
  // must surface honestly rather than silently opening a demo product's
  // Ask LabelGuard as if it were the user's real scan.
  const productId = searchParams.get('product');
  const findingId = searchParams.get('finding');

  // Real scans live only in this browser's localStorage (see
  // realProduct.ts), which doesn't exist during SSR. Resolving `product`
  // straight from `resolveProductById` in the render body would make the
  // server's render (no localStorage → no product) and the client's very
  // first hydration render (localStorage already available → real product
  // found) diverge, which is exactly what triggers a hydration mismatch.
  // `mounted` starts `false` on both server and client and only flips
  // after the client has committed the first render, so the initial
  // render — server AND client's first pass — is guaranteed identical;
  // the real localStorage-backed lookup only happens afterwards.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const product = useMemo(
    () => (mounted ? resolveProductById(productId) : undefined),
    [mounted, productId]
  );
  // Gated on `mounted` too: before the real lookup has run, we don't yet
  // know whether the product exists, so this must not read as "missing".
  const productUnavailable = mounted && Boolean(productId) && !product;
  const isRealScan = isRealUploadId(productId);

  const focus = useMemo(
    () => (product ? resolveFocusFinding(product, findingId) : null),
    [product, findingId]
  );

  const productContext = useMemo<CopilotProductContext | null>(
    () => (product ? buildProductContext(product, isRealScan, focus?.declaration.id) : null),
    [product, isRealScan, focus]
  );

  // Shared language state — same choice persists across this page, the
  // Scan Copilot widget, and reloads (see useCopilotLanguage).
  const { language, setLanguage } = useCopilotLanguage();

  // Shared chat/AI-request logic — same hook the Scan Copilot widget
  // uses, so there is exactly one implementation of "talk to the API".
  const { messages, input, setInput, loading, sendToAssistant } = useAskLabelGuard({
    assistantMode: 'copilot',
    productContext,
    productId: product?.id ?? null,
    language,
  });

  const autoAskedRef = React.useRef(false);

  // "Ask LabelGuard about this finding" arrives here with a specific
  // finding already selected — ask about it automatically once so the
  // click immediately produces an explanation, instead of an empty chat.
  useEffect(() => {
    if (autoAskedRef.current || !focus) return;
    autoAskedRef.current = true;
    sendToAssistant(
      `Why was "${focus.declaration.field}" marked ${focus.declaration.status}? Explain using the evidence for this finding.`
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  const suggestions = product ? PRODUCT_SUGGESTIONS : GENERAL_SUGGESTIONS;

  // Deterministic, storage-independent shell — identical on the server and
  // on the client's first render, before `mounted` flips to true. Every
  // hook above still runs on every render regardless of this branch, so
  // hook order stays stable; only the JSX output is gated here.
  if (!mounted) {
    return (
      <AppLayout currentRoute="/">
        <div className="max-w-3xl mx-auto flex flex-col h-[calc(100dvh-8rem)] min-h-[520px] items-center justify-center gap-3">
          <Bot size={28} className="text-accent" />
          <p className="text-sm text-muted-foreground">Loading Ask LabelGuard…</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout currentRoute="/">
      <div className="max-w-3xl mx-auto flex flex-col h-[calc(100dvh-8rem)] min-h-[520px]">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4 flex-shrink-0">
          <button
            onClick={() => router.back()}
            className="btn-ghost p-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            aria-label="Go back"
          >
            <ArrowLeft size={17} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Bot size={20} className="text-accent" />
              <h1 className="text-2xl font-extrabold text-navy">Ask LabelGuard</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1 truncate">
              {product
                ? `Chatting about ${product.name}${isRealScan ? '' : ' (demo product)'}`
                : 'General website & compliance guidance'}
            </p>
          </div>
        </div>

        {productUnavailable && (
          <div className="card p-4 mb-4 border-review-border bg-review-bg flex items-start gap-3 flex-shrink-0">
            <Info size={18} className="text-review flex-shrink-0 mt-0.5" />
            <p className="text-sm text-navy">
              We couldn&rsquo;t load that product record — it may have been cleared from this
              browser, or the link is out of date. Ask LabelGuard can still help with general
              questions about using the site.
            </p>
          </div>
        )}

        <CopilotChatPanel
          messages={messages}
          loading={loading}
          input={input}
          onInputChange={setInput}
          onSend={sendToAssistant}
          suggestions={suggestions}
          placeholder={product ? "Ask about this product's report…" : 'Ask how to use LabelGuard…'}
          emptyStateText={
            product
              ? `Ask about ${product.name}\u2019s findings, what to fix first, or how to use the site.`
              : 'Ask how to use LabelGuard, or open a scan to ask about your own results.'
          }
          language={language}
          onLanguageChange={setLanguage}
        />
      </div>
    </AppLayout>
  );
}

export default function CopilotPage() {
  return (
    <Suspense
      fallback={
        <AppLayout currentRoute="/">
          <div className="max-w-3xl mx-auto flex flex-col h-[calc(100dvh-8rem)] min-h-[520px] items-center justify-center gap-3">
            <Bot size={28} className="text-accent" />
            <p className="text-sm text-muted-foreground">Loading Ask LabelGuard…</p>
          </div>
        </AppLayout>
      }
    >
      <CopilotContent />
    </Suspense>
  );
}
