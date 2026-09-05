'use client';

import React, { useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { getProductById, type Declaration, type Finding } from '@/lib/mockData';
import ProductImageMap from './ProductImageMap';
import FindingsPanel from './FindingPanel';
import QualityScoreCard from './QualityScoreCard';
import FindingDetailPanel from './FindingDetailPanel';
import ReadabilityTable from './ReadabilityTab';
import ComplianceMapToolbar from './ComplianceMapToolbar';

export default function ComplianceMapContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const productId = searchParams.get('product') || 'product-b-001';
  const product = getProductById(productId);

  const [selectedDeclarationId, setSelectedDeclarationId] = useState<string | null>(null);
  const [hoveredDeclarationId, setHoveredDeclarationId] = useState<string | null>(null);

  const handleSelectDeclaration = useCallback((id: string | null) => {
    setSelectedDeclarationId((prev) => (prev === id ? null : id));
  }, []);

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

  const selectedDeclaration = product.declarations.find(
    (d) => d.id === selectedDeclarationId
  ) || null;

  const selectedFinding = selectedDeclaration
    ? product.findings.find((f) => f.declarationId === selectedDeclaration.id) || null
    : null;

  return (
    <div className="max-w-screen-xl mx-auto space-y-5">
      {/* Toolbar */}
      <ComplianceMapToolbar product={product} />

      {/* Main split layout */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
        {/* LEFT: Product image with bounding boxes */}
        <div className="xl:col-span-3 space-y-4">
          <ProductImageMap
            product={product}
            selectedDeclarationId={selectedDeclarationId}
            hoveredDeclarationId={hoveredDeclarationId}
            onSelectDeclaration={handleSelectDeclaration}
            onHoverDeclaration={setHoveredDeclarationId}
          />

          {/* Readability table */}
          <ReadabilityTable declarations={product.declarations} />
        </div>

        {/* RIGHT: Findings panel + score + detail */}
        <div className="xl:col-span-2 space-y-4">
          {/* Quality score */}
          <QualityScoreCard
            score={product.qualityScore}
            breakdown={product.scoreBreakdown}
          />

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
              productId={productId}
            />
          )}
        </div>
      </div>
    </div>
  );
}
