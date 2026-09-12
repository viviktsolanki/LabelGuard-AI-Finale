'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import {
  type BoundingBox,
  type ImageId,
  type ProductAnalysis,
  imageUrlForId,
} from '@/lib/mockData';
import { resolveProductById, isRealUploadId } from '@/lib/realProduct';
import ProductImageMap from './ProductImageMap';
import FindingsPanel from './FindingPanel';
import QualityScoreCard from './QualityScoreCard';
import FindingDetailPanel from './FindingDetailPanel';
import ReadabilityTable from './ReadabilityTab';
import ComplianceMapToolbar from './ComplianceMapToolbar';
import ResultsSummary from './ResultsSummary';

export default function ComplianceMapContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const productId = searchParams.get('product');

  // Real uploads are stored client-side (localStorage) keyed by a
  // `real-upload-...` id; everything else falls back to the existing
  // mockData.ts deterministic demo products. resolveProductById is the
  // single shared lookup used by every page keyed by product id.
  //
  // IMPORTANT: there is deliberately NO fallback to a demo product id here.
  // A missing/unresolvable `?product=` id must show an honest "not found"
  // state — silently substituting a demo product would mean a broken link
  // to a real scan (e.g. a failed save, a stale bookmark, direct navigation
  // without the id) quietly shows someone else's demo data instead.
  //
  // HYDRATION FIX: a real-upload id can only be resolved from localStorage,
  // which doesn't exist during SSR. Calling resolveProductById directly in
  // the render body (the previous behavior) meant the server-rendered HTML
  // always showed "Product not found" for a real upload, while the very
  // first client render (already running in the browser, with
  // localStorage available) showed the real compliance map — a content
  // mismatch between server and client output on the most important page
  // a user hits right after paying for analysis. Report/Compare already
  // avoid this (see ReportContent.tsx / CompareContent.tsx): a real-upload
  // id starts unresolved and is only looked up after mount, so the first
  // client render matches the server-rendered HTML exactly; demo ids still
  // resolve synchronously since they need no storage access.
  const [product, setProduct] = useState<ProductAnalysis | null>(() => {
    if (productId && isRealUploadId(productId)) return null;
    return resolveProductById(productId) ?? null;
  });
  const [realProductLookupDone, setRealProductLookupDone] = useState(false);

  useEffect(() => {
    if (!productId || !isRealUploadId(productId)) return;
    setProduct(resolveProductById(productId) ?? null);
    setRealProductLookupDone(true);
  }, [productId]);

  // Optional deep-link to a specific finding, e.g. `?finding=decl-b-004`.
  // Applied once via an effect (rather than a useState lazy initializer)
  // so it still works for a real-upload product, which may not be
  // resolved yet on the very first render — see the hydration fix above.
  const initialFindingId = searchParams.get('finding');
  const [selectedDeclarationId, setSelectedDeclarationId] = useState<string | null>(null);
  const [hoveredDeclarationId, setHoveredDeclarationId] = useState<string | null>(null);
  const [activeSide, setActiveSide] = useState<ImageId>('front');
  const appliedInitialFindingRef = useRef(false);

  useEffect(() => {
    if (appliedInitialFindingRef.current) return;
    // Still waiting on a real-upload product to resolve — don't apply
    // (or give up on) the deep link until we know whether it exists.
    if (productId && isRealUploadId(productId) && !realProductLookupDone) return;
    appliedInitialFindingRef.current = true;

    if (!initialFindingId || !product) return;
    const decl = product.declarations.find((d) => d.id === initialFindingId);
    if (!decl) return;

    setSelectedDeclarationId(initialFindingId);
    const targetSide = decl.evidence?.image;
    if (targetSide) {
      setActiveSide(targetSide);
    } else if (decl.source && decl.source !== 'both') {
      setActiveSide(decl.source);
    }
  }, [product, productId, initialFindingId, realProductLookupDone]);

  const handleSelectDeclaration = useCallback(
    (id: string | null) => {
      setSelectedDeclarationId((prev) => {
        const next = prev === id ? null : id;

        if (next && product) {
          // Clicking a finding switches the Compliance Map to whichever
          // image (front, back, or an additional view) its evidence
          // actually lives on. If the declaration's source is "both" (or
          // evidence is missing) we leave the currently active view as-is
          // so the user can switch manually.
          const decl = product.declarations.find((d) => d.id === next);
          const targetSide = decl?.evidence?.image;

          if (targetSide) {
            setActiveSide(targetSide);
          } else if (decl?.source && decl.source !== 'both') {
            setActiveSide(decl.source);
          }
        }

        return next;
      });
    },
    [product]
  );

  if (!product) {
    // A real-upload id that hasn't finished its post-mount localStorage
    // lookup yet is "still loading", not "not found" — showing the
    // honest not-found state here would flash briefly before the real
    // product resolves on nearly every real-upload page load.
    if (productId && isRealUploadId(productId) && !realProductLookupDone) {
      return (
        <div className="max-w-lg mx-auto py-20 text-center space-y-3">
          <Loader2 size={28} className="text-accent mx-auto animate-spin" />
          <p className="text-sm text-muted-foreground">Loading compliance map…</p>
        </div>
      );
    }

    return (
      <div className="max-w-lg mx-auto py-20 text-center space-y-4">
        <AlertCircle size={48} className="text-flag mx-auto" />
        <h2 className="text-xl font-bold text-navy">Product not found</h2>
        <p className="text-muted-foreground text-sm">
          This product analysis could not be loaded. Please run a new scan.
        </p>
        <button onClick={() => router.push('/')} className="btn-primary">
          <ArrowLeft size={16} />
          Back to Scan
        </button>
      </div>
    );
  }

  const selectedDeclaration =
    product.declarations.find((d) => d.id === selectedDeclarationId) || null;

  const selectedFinding = selectedDeclaration
    ? product.findings.find((f) => f.declarationId === selectedDeclaration.id) || null
    : null;

  // Resolve the image + region to show as a zoomed evidence excerpt in the
  // detail panel. Two real, non-invented sources only:
  //  1. `evidence` — the AI-located, validated region (real uploads). When
  //     this key exists on the declaration at all but is `null`, the AI
  //     could not confidently locate it — that must fall through to "no
  //     excerpt", never guess a box.
  //  2. `boundingBox` — used ONLY when `evidence` is `undefined` (i.e. this
  //     is a legacy mockData.ts demo product, which has no `evidence` key
  //     and always shows a single front image). Real uploads always set
  //     `evidence` (to a region or null) and their `boundingBox` is a
  //     placeholder, so this path never fires for them.
  let evidenceImageUrl: string | null = null;
  let evidenceRegion: BoundingBox | null = null;

  if (selectedDeclaration) {
    if (selectedDeclaration.evidence) {
      const url = imageUrlForId(product, selectedDeclaration.evidence.image);
      if (url) {
        evidenceImageUrl = url;
        evidenceRegion = selectedDeclaration.evidence;
      }
    } else if (
      selectedDeclaration.evidence === undefined &&
      selectedDeclaration.boundingBox.width > 0 &&
      selectedDeclaration.boundingBox.height > 0
    ) {
      evidenceImageUrl = product.imageUrl;
      evidenceRegion = selectedDeclaration.boundingBox;
    }
  }

  return (
    <div className="max-w-screen-xl mx-auto space-y-5">
      {/* Toolbar */}
      <ComplianceMapToolbar product={product} />

      {/* Phase 5C: top-level results hierarchy — score, status, counts,
          most critical finding, recommended next action */}
      <ResultsSummary product={product} onSelectCriticalFinding={handleSelectDeclaration} />

      {/* Main split layout */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
        {/* LEFT: Product image with bounding boxes */}
        <div className="xl:col-span-3 space-y-4">
          <ProductImageMap
            product={product}
            selectedDeclarationId={selectedDeclarationId}
            hoveredDeclarationId={hoveredDeclarationId}
            activeSide={activeSide}
            onSelectDeclaration={handleSelectDeclaration}
            onHoverDeclaration={setHoveredDeclarationId}
            onSetActiveSide={setActiveSide}
          />

          {/* Readability table */}
          <ReadabilityTable declarations={product.declarations} />
        </div>

        {/* RIGHT: Findings panel + score + detail */}
        <div className="xl:col-span-2 space-y-4">
          {/* Quality score */}
          <QualityScoreCard score={product.qualityScore} breakdown={product.scoreBreakdown} />

          {/* Findings list */}
          <FindingsPanel
            declarations={product.declarations}
            findings={product.findings}
            selectedDeclarationId={selectedDeclarationId}
            onSelectDeclaration={handleSelectDeclaration}
            onHoverDeclaration={setHoveredDeclarationId}
          />

          {/* Finding detail */}
          {selectedDeclaration && (
            <FindingDetailPanel
              declaration={selectedDeclaration}
              finding={selectedFinding}
              productId={product.id}
              evidenceImageUrl={evidenceImageUrl}
              evidenceRegion={evidenceRegion}
            />
          )}
        </div>
      </div>
    </div>
  );
}
