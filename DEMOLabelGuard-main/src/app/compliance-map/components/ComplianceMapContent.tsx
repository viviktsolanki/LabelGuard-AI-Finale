'use client';

import React, { useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { type ImageId } from '@/lib/mockData';
import { resolveProductById } from '@/lib/realProduct';
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
  const product = resolveProductById(productId);

  // Optional deep-link to a specific finding, e.g. `?finding=decl-b-004`.
  // Only read once on mount (declarationId is looked up against the
  // already-resolved `product` below); absent in the overwhelming
  // majority of links, in which case this is exactly the previous
  // behavior (selectedDeclarationId starts null).
  const initialFindingId = searchParams.get('finding');
  const [selectedDeclarationId, setSelectedDeclarationId] = useState<string | null>(
    () =>
      (initialFindingId &&
        product?.declarations.some((d) => d.id === initialFindingId) &&
        initialFindingId) ||
      null
  );
  const [hoveredDeclarationId, setHoveredDeclarationId] = useState<string | null>(null);
  const [activeSide, setActiveSide] = useState<ImageId>(() => {
    if (!initialFindingId || !product) return 'front';
    const decl = product.declarations.find((d) => d.id === initialFindingId);
    const targetSide = decl?.evidence?.image;
    if (targetSide) return targetSide;
    if (decl?.source && decl.source !== 'both') return decl.source;
    return 'front';
  });

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
            />
          )}
        </div>
      </div>
    </div>
  );
}
