'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  FileText,
  Download,
  Edit3,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Shield,
  Info,
  ScanLine,
  Video,
  Loader2,
} from 'lucide-react';
import {
  DEMO_PRODUCTS,
  imageLabelFor,
  type ProductAnalysis,
  type Finding,
  type Declaration,
  type ImageId,
} from '@/lib/mockData';
import { getAllRealProducts, isRealUploadId } from '@/lib/realProduct';
import {
  buildStructuredReportPdf,
  downloadBlob,
  downloadPdfBlob,
  PDF_COLORS,
  type ReportBlock,
} from '@/lib/pdfExport';
import {
  getComplianceInsights,
  getConfidenceSource,
  describeConfidenceSource,
} from '@/lib/complianceInsights';
import SmartSummaryCard from './SmartSummaryCard';
import PriorityActionPlan from './PriorityActionPlan';

/** Report sections, used for the in-page quick-jump nav. Anchors only —
 * no new routes, just scrolling within the existing report page. */
const REPORT_SECTIONS: { id: string; label: string }[] = [
  { id: 'report-summary', label: 'Summary' },
  { id: 'report-score', label: 'Score' },
  { id: 'report-actions', label: 'Priority Actions' },
  { id: 'report-declarations', label: 'Declarations' },
  { id: 'report-findings', label: 'Findings' },
];

/** mm:ss for a video-extracted evidence frame. Returns null when no
 * timestamp is available — never invented. */
function formatVideoTimestamp(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Looks up the video timestamp (if any) an image on this product was
 * extracted from — front, back, or an additional view. Reads only fields
 * `realProduct.ts`/`mockData.ts` already populate; never invents one. */
function getImageVideoTimestamp(
  product: ProductAnalysis,
  image: ImageId | 'both' | null | undefined
): number | null {
  if (!image || image === 'both') return null;
  if (image === 'front') return product.frontVideoTimestampSeconds ?? null;
  if (image === 'back') return product.backVideoTimestampSeconds ?? null;
  return product.additionalImages?.find((a) => a.id === image)?.videoTimestampSeconds ?? null;
}

/** Human-readable evidence source line for a declaration/finding, combining
 * which image the value came from with its video timestamp when the source
 * image was extracted from a scanned video rather than a manual photo. */
function describeEvidenceSource(
  product: ProductAnalysis,
  image: ImageId | 'both' | null | undefined
): string | null {
  if (!image) return null;
  const label = image === 'both' ? 'Front & back' : imageLabelFor(image);
  const ts = getImageVideoTimestamp(product, image);
  return ts !== null ? `${label} (video ${formatVideoTimestamp(ts)})` : label;
}

function StatusBadge({ status }: { status: 'PASS' | 'REVIEW' | 'FLAG' }) {
  if (status === 'PASS')
    return (
      <span className="status-badge badge-pass">
        <CheckCircle2 size={10} /> PASS
      </span>
    );
  if (status === 'REVIEW')
    return (
      <span className="status-badge badge-review">
        <AlertCircle size={10} /> REVIEW
      </span>
    );
  return (
    <span className="status-badge badge-flag">
      <XCircle size={10} /> FLAG
    </span>
  );
}

function ProductSelector({
  selected,
  options,
  onChange,
}: {
  selected: ProductAnalysis;
  options: ProductAnalysis[];
  onChange: (p: ProductAnalysis) => void;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  }, []);

  return (
    <div
      className="relative"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          close(true);
        }
      }}
    >
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="focus-ring flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-muted transition-all text-sm font-medium text-navy"
      >
        <span>{selected.name}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Select product"
          className="absolute top-full left-0 mt-1 z-20 bg-card border border-border rounded-xl shadow-lg overflow-hidden min-w-[240px] max-h-72 overflow-y-auto"
        >
          {options.map((p) => (
            <button
              key={p.id}
              role="option"
              aria-selected={selected.id === p.id}
              onClick={() => {
                onChange(p);
                close(true);
              }}
              className={`focus-ring w-full flex items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-muted transition-all ${selected.id === p.id ? 'bg-accent/5 text-accent font-semibold' : 'text-foreground'}`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="truncate">{p.name}</span>
                {isRealUploadId(p.id) ? (
                  <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-accent/10 text-accent text-[10px] font-semibold">
                    <ScanLine size={9} /> Real scan
                  </span>
                ) : (
                  <span className="flex-shrink-0 px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-semibold">
                    Demo
                  </span>
                )}
              </span>
              <span className="flex-shrink-0 text-xs text-muted-foreground">
                Score {p.qualityScore}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Quick-jump nav for scrolling to report sections. Reuses in-page anchors
 * only — no new routes. Hidden until there's more than a screenful of
 * report to jump around in. */
function ReportQuickNav() {
  return (
    <nav aria-label="Report sections" className="flex flex-wrap gap-1.5 -mx-1 px-1 overflow-x-auto">
      {REPORT_SECTIONS.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className="focus-ring whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-accent hover:bg-accent/5 transition-all"
        >
          {s.label}
        </a>
      ))}
    </nav>
  );
}

const SEVERITY_RANK: Record<'FLAG' | 'REVIEW' | 'PASS', number> = { FLAG: 0, REVIEW: 1, PASS: 2 };

/** Most critical (FLAG) findings first, so they're the first thing a reader
 * sees — display ordering only, never touches scoring/analysis data. */
function sortFindingsBySeverity(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

function statusPdfColor(status: 'PASS' | 'REVIEW' | 'FLAG') {
  if (status === 'PASS') return PDF_COLORS.pass;
  if (status === 'REVIEW') return PDF_COLORS.review;
  return PDF_COLORS.flag;
}

/** Builds the structured PDF block list for a product's report, straight
 * from the same `ProductAnalysis` + compliance insights data the on-screen
 * report and TXT export use — no new analysis, just presentation. */
function buildReportPdfBlocks(product: ProductAnalysis): ReportBlock[] {
  const insights = getComplianceInsights(product);
  const { priorityActionPlan } = insights;
  const blocks: ReportBlock[] = [];

  blocks.push({ type: 'title', text: 'LabelGuard AI — Compliance Screening Report' });
  blocks.push({
    type: 'subtitle',
    text: 'AI-assisted screening — not an official legal certification.',
  });

  blocks.push({ type: 'heading', text: 'Product' });
  blocks.push({ type: 'keyvalue', label: 'Product', value: product.name });
  blocks.push({ type: 'keyvalue', label: 'Category', value: product.category });
  blocks.push({ type: 'keyvalue', label: 'Analyzed', value: product.analyzedAt });
  blocks.push({
    type: 'keyvalue',
    label: 'Compliance Screening Score',
    value: `${product.qualityScore} / 100`,
    color: statusPdfColor(
      product.qualityScore >= 85 ? 'PASS' : product.qualityScore >= 70 ? 'REVIEW' : 'FLAG'
    ),
  });
  blocks.push({ type: 'spacer' });

  blocks.push({ type: 'heading', text: 'Summary' });
  blocks.push({ type: 'keyvalue', label: 'Overall status', value: insights.overallStatus });
  blocks.push({
    type: 'keyvalue',
    label: 'PASS',
    value: String(insights.passCount),
    color: PDF_COLORS.pass,
  });
  blocks.push({
    type: 'keyvalue',
    label: 'REVIEW',
    value: String(insights.reviewCount),
    color: PDF_COLORS.review,
  });
  blocks.push({
    type: 'keyvalue',
    label: 'FLAG',
    value: String(insights.flagCount),
    color: PDF_COLORS.flag,
  });
  blocks.push({
    type: 'keyvalue',
    label: 'Most critical issue',
    value: insights.mostCriticalIssue ? insights.mostCriticalIssue.title : 'None detected',
  });
  blocks.push({
    type: 'keyvalue',
    label: 'Recommended next action',
    value: insights.recommendedNextAction,
  });
  if (insights.strongestArea)
    blocks.push({
      type: 'keyvalue',
      label: 'Strongest area',
      value: `${insights.strongestArea.label} (${insights.strongestArea.value})`,
    });
  if (insights.weakestArea)
    blocks.push({
      type: 'keyvalue',
      label: 'Weakest area',
      value: `${insights.weakestArea.label} (${insights.weakestArea.value})`,
    });
  blocks.push({ type: 'spacer' });

  blocks.push({ type: 'heading', text: 'Score Breakdown' });
  blocks.push({
    type: 'keyvalue',
    label: 'Mandatory declarations',
    value: String(product.scoreBreakdown.mandatoryDeclarations),
  });
  blocks.push({
    type: 'keyvalue',
    label: 'Readability',
    value: String(product.scoreBreakdown.readability),
  });
  blocks.push({
    type: 'keyvalue',
    label: 'Extraction confidence',
    value: String(product.scoreBreakdown.extractionConfidence),
  });
  blocks.push({
    type: 'keyvalue',
    label: 'Placement / visibility',
    value: String(product.scoreBreakdown.placementVisibility),
  });
  blocks.push({
    type: 'keyvalue',
    label: 'Label consistency',
    value: String(product.scoreBreakdown.labelConsistency),
  });
  blocks.push({ type: 'spacer' });

  const actionGroup = (
    label: string,
    actions: typeof priorityActionPlan.priority1,
    color: [number, number, number]
  ) => {
    if (actions.length === 0) return;
    blocks.push({ type: 'text', text: label, bold: true, color });
    actions.forEach((a) => {
      blocks.push({
        type: 'bullet',
        text: `[${a.status}] ${a.issue}${a.declarationField ? ` (${a.declarationField})` : ''} — ${a.recommendation}`,
        color,
      });
    });
    blocks.push({ type: 'spacer' });
  };

  const hasActions =
    priorityActionPlan.priority1.length +
      priorityActionPlan.priority2.length +
      priorityActionPlan.priority3.length >
    0;
  blocks.push({ type: 'heading', text: 'Priority Action Plan' });
  if (!hasActions) {
    blocks.push({ type: 'text', text: 'No outstanding actions.' });
    blocks.push({ type: 'spacer' });
  } else {
    actionGroup('Priority 1 — Critical', priorityActionPlan.priority1, PDF_COLORS.flag);
    actionGroup('Priority 2 — Important', priorityActionPlan.priority2, PDF_COLORS.review);
    actionGroup('Priority 3 — Recommended', priorityActionPlan.priority3, PDF_COLORS.pass);
  }

  blocks.push({ type: 'heading', text: 'Declarations' });
  product.declarations.forEach((d) => {
    const source = describeEvidenceSource(product, d.source);
    blocks.push({
      type: 'text',
      text: `[${d.status}] ${d.field}: ${d.extractedText || d.value} — Confidence ${d.confidence}%, Readability ${d.readabilityPx}px${source ? `, Source: ${source}` : ''}`,
      color: statusPdfColor(d.status),
    });
  });
  blocks.push({ type: 'spacer' });

  blocks.push({ type: 'heading', text: 'Findings & Evidence (most critical first)' });
  sortFindingsBySeverity(product.findings).forEach((f) => {
    const decl = product.declarations.find((d) => d.id === f.declarationId);
    const source = decl ? describeEvidenceSource(product, decl.source) : null;
    blocks.push({
      type: 'text',
      text: `[${f.severity}] ${f.title}`,
      bold: true,
      color: statusPdfColor(f.severity),
    });
    blocks.push({ type: 'text', text: `Check: ${f.ruleCheck}`, indent: 10 });
    blocks.push({
      type: 'text',
      text: `Detected: ${f.detectedText}  ·  Confidence: ${f.confidence}%`,
      indent: 10,
    });
    blocks.push({
      type: 'text',
      text: `Evidence: ${f.evidenceRegion}${source ? ` (${source})` : ''}`,
      indent: 10,
    });
    blocks.push({ type: 'text', text: f.explanation, indent: 10, color: PDF_COLORS.muted });
    blocks.push({
      type: 'text',
      text: `Recommendation: ${f.recommendation}`,
      indent: 10,
      color: PDF_COLORS.accent,
    });
    blocks.push({
      type: 'text',
      text: `Source of confidence: ${describeConfidenceSource(getConfidenceSource(f, decl))}`,
      indent: 10,
      color: PDF_COLORS.muted,
    });
    blocks.push({ type: 'spacer' });
  });

  blocks.push({ type: 'divider' });
  blocks.push({ type: 'heading', text: 'Disclaimer' });
  blocks.push({
    type: 'text',
    text: 'This report is generated by LabelGuard AI and is intended for informational purposes only. It does not constitute legal certification or official compliance verification. All findings are AI-assisted and require manual verification by a qualified inspector.',
    color: PDF_COLORS.muted,
  });
  blocks.push({
    type: 'text',
    text: `Generated: ${new Date().toUTCString()}`,
    color: PDF_COLORS.muted,
  });

  return blocks;
}

function generateReportText(product: ProductAnalysis): string {
  const insights = getComplianceInsights(product);
  const { priorityActionPlan } = insights;

  const priorityActionLines = (
    label: string,
    actions: typeof priorityActionPlan.priority1
  ): string[] =>
    actions.length === 0
      ? []
      : [
          label,
          ...actions.map(
            (a) =>
              `  - [${a.status}] ${a.issue}${a.declarationField ? ` (${a.declarationField})` : ''}\n    Recommendation: ${a.recommendation}`
          ),
          '',
        ];

  const lines: string[] = [
    'LABELGUARD AI — COMPLIANCE SCREENING REPORT',
    '='.repeat(50),
    '',
    `Product: ${product.name}`,
    `Category: ${product.category}`,
    `Analyzed: ${product.analyzedAt}`,
    `Compliance Screening Score: ${product.qualityScore} / 100`,
    '',
    'SCORE BREAKDOWN',
    '-'.repeat(30),
    `Mandatory declarations:    ${product.scoreBreakdown.mandatoryDeclarations}`,
    `Readability:               ${product.scoreBreakdown.readability}`,
    `Extraction confidence:     ${product.scoreBreakdown.extractionConfidence}`,
    `Placement / visibility:    ${product.scoreBreakdown.placementVisibility}`,
    `Label consistency:         ${product.scoreBreakdown.labelConsistency}`,
    '',
    'SUMMARY OF FINDINGS',
    '-'.repeat(30),
    `PASS:   ${product.passCount}`,
    `REVIEW: ${product.reviewCount}`,
    `FLAG:   ${product.flagCount}`,
    '',
    'SMART COMPLIANCE SUMMARY',
    '-'.repeat(30),
    `Overall status:            ${insights.overallStatus}`,
    `Overall score:              ${insights.overallScore} / 100`,
    `Most critical issue:        ${insights.mostCriticalIssue ? insights.mostCriticalIssue.title : 'None detected'}`,
    `Recommended next action:    ${insights.recommendedNextAction}`,
    `Strongest area:              ${insights.strongestArea ? `${insights.strongestArea.label} (${insights.strongestArea.value})` : 'N/A'}`,
    `Weakest area:                ${insights.weakestArea ? `${insights.weakestArea.label} (${insights.weakestArea.value})` : 'N/A'}`,
    '',
    'PRIORITY ACTION PLAN',
    '-'.repeat(30),
    ...(priorityActionLines('PRIORITY 1 — CRITICAL', priorityActionPlan.priority1).length +
      priorityActionLines('PRIORITY 2 — IMPORTANT', priorityActionPlan.priority2).length +
      priorityActionLines('PRIORITY 3 — RECOMMENDED', priorityActionPlan.priority3).length ===
    0
      ? ['No outstanding actions.', '']
      : [
          ...priorityActionLines('PRIORITY 1 — CRITICAL', priorityActionPlan.priority1),
          ...priorityActionLines('PRIORITY 2 — IMPORTANT', priorityActionPlan.priority2),
          ...priorityActionLines('PRIORITY 3 — RECOMMENDED', priorityActionPlan.priority3),
        ]),
    'DECLARATIONS',
    '-'.repeat(30),
    ...product.declarations.map((d) => {
      const source = describeEvidenceSource(product, d.source);
      return `[${d.status}] ${d.field}: ${d.extractedText || d.value} (Confidence: ${d.confidence}%, Readability: ${d.readabilityPx}px)${source ? `\n  Source: ${source}` : ''}`;
    }),
    '',
    'FINDINGS & EVIDENCE (most critical first)',
    '-'.repeat(30),
    ...sortFindingsBySeverity(product.findings).map((f) => {
      const decl = product.declarations.find((d) => d.id === f.declarationId);
      const source = decl ? describeEvidenceSource(product, decl.source) : null;
      const confidenceSource = describeConfidenceSource(getConfidenceSource(f, decl));
      return `[${f.severity}] ${f.title}\n  Check: ${f.ruleCheck}\n  Detected: ${f.detectedText}\n  Confidence: ${f.confidence}%\n  Evidence: ${f.evidenceRegion}${source ? ` (${source})` : ''}\n  Explanation: ${f.explanation}\n  Recommendation: ${f.recommendation}\n  Source of confidence: ${confidenceSource}\n`;
    }),
    '',
    'DISCLAIMER',
    '-'.repeat(30),
    'This report is generated by LabelGuard AI and is intended for informational purposes only.',
    'It does not constitute legal certification or official compliance verification.',
    'All findings are AI-assisted and require manual verification by a qualified inspector.',
    'AI-assisted screening — not an official legal certification.',
    '',
    `Generated: ${new Date().toUTCString()}`,
  ];
  return lines.join('\n');
}

function exportText(product: ProductAnalysis): boolean {
  try {
    const text = generateReportText(product);
    const blob = new Blob([text], { type: 'text/plain' });
    // Shared download helper (see pdfExport.ts) — attaches the anchor to
    // the DOM and defers URL.revokeObjectURL so the download reliably
    // fires on mobile browsers instead of racing the cleanup.
    downloadBlob(blob, `labelguard-report-${product.id}.txt`);
    return true;
  } catch (error) {
    console.error('LabelGuard TXT export failed:', error);
    return false;
  }
}

function exportPDF(product: ProductAnalysis): boolean {
  try {
    const pdfBlob = buildStructuredReportPdf(buildReportPdfBlocks(product));
    downloadPdfBlob(pdfBlob, `labelguard-report-${product.id}.pdf`);
    return true;
  } catch (error) {
    console.error('LabelGuard PDF export failed:', error);
    return false;
  }
}

export default function ReportContent() {
  const searchParams = useSearchParams();
  const preselectedId = searchParams.get('product');

  // Real scans (localStorage) are only available client-side, loaded after
  // mount and merged with the always-available demo products — the same
  // pattern used by Compare and History so all three pages offer a
  // consistent, single list of real + demo products.
  const [realProducts, setRealProducts] = useState<ProductAnalysis[]>([]);

  useEffect(() => {
    setRealProducts(getAllRealProducts());
  }, []);

  const availableProducts = useMemo(() => [...realProducts, ...DEMO_PRODUCTS], [realProducts]);

  // Real products live in localStorage and aren't available synchronously
  // on first render, so a `?product=` id pointing at a real scan must NOT
  // resolve to a demo product on the first paint and then swap later —
  // that would flash someone else's demo data for a real report. Instead:
  // - no `?product=` at all -> default demo product immediately (there's
  //   nothing real to wait for).
  // - `?product=` matches a demo id -> resolve immediately (no async wait).
  // - `?product=` looks like a real upload id -> start as `null` (loading)
  //   until the client-side localStorage read completes.
  const [product, setProduct] = useState<ProductAnalysis | null>(() => {
    if (!preselectedId) return DEMO_PRODUCTS[1];
    if (isRealUploadId(preselectedId)) return null;
    return DEMO_PRODUCTS.find((p) => p.id === preselectedId) || DEMO_PRODUCTS[1];
  });

  // Once real scans have loaded from localStorage, resolve the requested
  // real product id — e.g. via the Compliance Map toolbar's "Report" link.
  const [realProductLookupDone, setRealProductLookupDone] = useState(false);

  useEffect(() => {
    if (!preselectedId) return;
    const match = availableProducts.find((p) => p.id === preselectedId);
    if (match) setProduct(match);
    if (isRealUploadId(preselectedId)) setRealProductLookupDone(true);
  }, [preselectedId, availableProducts]);

  const handleExportPDF = useCallback(() => {
    if (!product) return;
    if (!exportPDF(product)) {
      toast.error('Could not generate the PDF report. Please try again.');
    }
  }, [product]);
  const handleExportText = useCallback(() => {
    if (!product) return;
    if (!exportText(product)) {
      toast.error('Could not generate the text export. Please try again.');
    }
  }, [product]);

  if (!product) {
    if (realProductLookupDone) {
      // Real scans finished loading from localStorage and none matched —
      // an honest "not found" state, never a silent demo substitute.
      return (
        <div className="max-w-lg mx-auto py-20 text-center space-y-4">
          <AlertCircle size={48} className="text-flag mx-auto" />
          <h2 className="text-xl font-bold text-navy">Report unavailable</h2>
          <p className="text-muted-foreground text-sm">
            This scan couldn&apos;t be loaded. It may have been cleared from this browser.
          </p>
        </div>
      );
    }

    return (
      <div className="max-w-lg mx-auto py-20 text-center space-y-3">
        <Loader2 size={28} className="text-accent mx-auto animate-spin" />
        <p className="text-sm text-muted-foreground">Loading report…</p>
      </div>
    );
  }

  const scoreColor =
    product.qualityScore >= 85
      ? 'text-pass'
      : product.qualityScore >= 70
        ? 'text-review'
        : 'text-flag';
  const scoreBg =
    product.qualityScore >= 85
      ? 'bg-pass/10'
      : product.qualityScore >= 70
        ? 'bg-review/10'
        : 'bg-flag/10';

  return (
    <div className="max-w-screen-lg mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
            <FileText size={20} className="text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-navy">Compliance Report</h1>
            <p className="text-sm text-muted-foreground">AI-assisted inspection report</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ProductSelector selected={product} options={availableProducts} onChange={setProduct} />
          <button
            onClick={handleExportText}
            className="focus-ring flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border bg-card text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            <Edit3 size={14} />
            Export Editable TXT
          </button>
          <button onClick={handleExportPDF} className="focus-ring btn-primary text-sm px-4 py-2.5">
            <Download size={14} />
            Export PDF
          </button>
        </div>
      </div>

      {/* Quick jump nav between report sections — anchors only, no new routes */}
      <ReportQuickNav />

      {/* NEW: Smart Compliance Summary */}
      <div id="report-summary" className="scroll-mt-6">
        <SmartSummaryCard product={product} />
      </div>

      {/* Product info + score */}
      <div id="report-score" className="scroll-mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 card p-5 space-y-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
            Product Information
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Product Name', value: product.name },
              { label: 'Category', value: product.category },
              { label: 'Analyzed', value: product.analyzedAt },
              { label: 'Report ID', value: `LG-${product.id.toUpperCase().slice(-6)}` },
            ].map((row) => (
              <div key={row.label}>
                <p className="text-xs text-muted-foreground">{row.label}</p>
                <p className="text-sm font-semibold text-navy">{row.value}</p>
              </div>
            ))}
          </div>
        </div>
        <div className={`card p-5 flex flex-col items-center justify-center gap-2 ${scoreBg}`}>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide text-center">
            Compliance Screening Score
          </p>
          <p className={`text-5xl font-extrabold ${scoreColor}`}>{product.qualityScore}</p>
          <p className="text-sm text-muted-foreground">out of 100</p>
        </div>
      </div>

      {/* Score breakdown */}
      <div className="card p-5 space-y-4">
        <p className="text-sm font-bold text-navy">Score Breakdown</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Mandatory decl.', value: product.scoreBreakdown.mandatoryDeclarations },
            { label: 'Readability', value: product.scoreBreakdown.readability },
            { label: 'Confidence', value: product.scoreBreakdown.extractionConfidence },
            { label: 'Placement', value: product.scoreBreakdown.placementVisibility },
            { label: 'Consistency', value: product.scoreBreakdown.labelConsistency },
          ].map((item) => (
            <div key={item.label} className="text-center space-y-1.5">
              <div className="relative w-12 h-12 mx-auto">
                <svg viewBox="0 0 44 44" className="w-12 h-12 -rotate-90">
                  <circle cx="22" cy="22" r="18" fill="none" stroke="var(--muted)" strokeWidth="4" />
                  <circle
                    cx="22"
                    cy="22"
                    r="18"
                    fill="none"
                    stroke={
                      item.value >= 85
                        ? 'var(--pass)'
                        : item.value >= 70
                          ? 'var(--review)'
                          : 'var(--flag)'
                    }
                    strokeWidth="4"
                    strokeDasharray={`${(item.value / 100) * 113} 113`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-navy">
                  {item.value}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground/70 italic text-center flex items-center justify-center gap-1">
          <Info size={10} />
          AI-assisted screening — not an official legal certification.
        </p>
      </div>

      {/* PASS/REVIEW/FLAG summary — the at-a-glance breakdown behind the
          Smart Compliance Summary card's counts above. */}
      <div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
          Findings by Severity
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-4 text-center border-pass/30">
            <CheckCircle2 size={20} className="text-pass mx-auto mb-1" />
            <p className="text-2xl font-extrabold text-pass">{product.passCount}</p>
            <p className="text-xs text-muted-foreground">PASS</p>
          </div>
          <div className="card p-4 text-center border-review/30">
            <AlertCircle size={20} className="text-review mx-auto mb-1" />
            <p className="text-2xl font-extrabold text-review">{product.reviewCount}</p>
            <p className="text-xs text-muted-foreground">REVIEW</p>
          </div>
          <div className="card p-4 text-center border-flag/30">
            <XCircle size={20} className="text-flag mx-auto mb-1" />
            <p className="text-2xl font-extrabold text-flag">{product.flagCount}</p>
            <p className="text-xs text-muted-foreground">FLAG</p>
          </div>
        </div>
      </div>

      {/* NEW: Priority Action Plan */}
      <div id="report-actions" className="scroll-mt-6">
        <PriorityActionPlan product={product} />
      </div>

      {/* Declaration table */}
      <div id="report-declarations" className="scroll-mt-6 card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-bold text-navy">Declaration Table</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Extracted values, confidence, source, and compliance status
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-5 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                  Field
                </th>
                <th className="text-left px-5 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                  Detected Value
                </th>
                <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                  Source
                </th>
                <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                  Confidence
                </th>
                <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                  Readability
                </th>
                <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {product.declarations.map((decl: Declaration, i: number) => {
                const source = describeEvidenceSource(product, decl.source);
                return (
                  <tr
                    key={decl.id}
                    className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/20'} ${decl.status === 'FLAG' ? 'border-l-2 border-l-flag' : ''}`}
                  >
                    <td className="px-5 py-3 font-medium text-navy">{decl.field}</td>
                    <td className="px-5 py-3 text-muted-foreground max-w-[200px] truncate font-mono text-xs">
                      {decl.extractedText || decl.value}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {source ? (
                        <span className="inline-flex items-center gap-1">
                          {source.includes('video') && (
                            <Video size={10} className="flex-shrink-0" />
                          )}
                          {source}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`text-xs font-semibold ${decl.confidence >= 80 ? 'text-pass' : decl.confidence >= 60 ? 'text-review' : 'text-flag'}`}
                      >
                        {decl.confidence}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`text-xs font-semibold ${decl.readabilityLabel === 'GOOD' ? 'text-pass' : decl.readabilityLabel === 'ACCEPTABLE' ? 'text-review' : 'text-flag'}`}
                      >
                        {decl.readabilityPx}px · {decl.readabilityLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={decl.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Findings */}
      {product.findings.length > 0 && (
        <div id="report-findings" className="scroll-mt-6 card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-bold text-navy">Findings & Evidence</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Most critical (FLAG) findings first — each links to extracted text and the compliance
              check that triggered it
            </p>
          </div>
          <div className="divide-y divide-border">
            {sortFindingsBySeverity(product.findings).map((finding: Finding) => {
              const declaration = product.declarations.find((d) => d.id === finding.declarationId);
              const source = declaration
                ? describeEvidenceSource(product, declaration.source)
                : null;
              const confidenceSource = getConfidenceSource(finding, declaration);
              return (
                <div
                  key={finding.id}
                  className={`px-5 py-4 space-y-3 ${finding.severity === 'FLAG' ? 'border-l-4 border-l-flag bg-flag/5' : finding.severity === 'REVIEW' ? 'border-l-4 border-l-review' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-navy">{finding.title}</p>
                    <StatusBadge status={finding.severity} />
                  </div>

                  {/* Evidence chain */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-0.5">Detected Text</p>
                      <p className="text-xs font-mono font-medium text-navy">
                        {finding.detectedText}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-0.5">Confidence</p>
                      <p
                        className={`text-xs font-bold ${finding.confidence >= 80 ? 'text-pass' : finding.confidence >= 60 ? 'text-review' : 'text-flag'}`}
                      >
                        {finding.confidence}%
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-0.5">Evidence Region</p>
                      <p className="text-xs font-medium text-navy">{finding.evidenceRegion}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-0.5">Compliance Check</p>
                      <p className="text-xs font-mono font-medium text-navy">{finding.ruleCheck}</p>
                    </div>
                    {source && (
                      <div className="p-2.5 rounded-lg bg-muted/50 col-span-2">
                        <p className="text-xs text-muted-foreground mb-0.5">Source</p>
                        <p className="text-xs font-medium text-navy inline-flex items-center gap-1">
                          {source.includes('video') && (
                            <Video size={11} className="flex-shrink-0" />
                          )}
                          {source}
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                      Why it matters
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {finding.explanation}
                    </p>
                  </div>

                  <div
                    className={`flex items-start gap-1.5 p-2.5 rounded-lg border ${
                      finding.severity === 'FLAG'
                        ? 'bg-flag-bg border-flag-border'
                        : finding.severity === 'REVIEW'
                          ? 'bg-review-bg border-review-border'
                          : 'bg-accent/5 border-accent/20'
                    }`}
                  >
                    <Info
                      size={12}
                      className={`mt-0.5 flex-shrink-0 ${finding.severity === 'FLAG' ? 'text-flag' : finding.severity === 'REVIEW' ? 'text-review' : 'text-accent'}`}
                    />
                    <p>
                      <span
                        className={`text-xs font-bold uppercase tracking-wide mr-1 ${finding.severity === 'FLAG' ? 'text-flag' : finding.severity === 'REVIEW' ? 'text-review' : 'text-accent'}`}
                      >
                        What to do:
                      </span>
                      <span
                        className={`text-xs leading-relaxed ${finding.severity === 'FLAG' ? 'text-flag' : finding.severity === 'REVIEW' ? 'text-review' : 'text-accent'}`}
                      >
                        {finding.recommendation}
                      </span>
                    </p>
                  </div>

                  {/* Source of confidence — what the AI detected vs. what
                      the deterministic rule engine validated vs. whether
                      real evidence was located, so trust isn't reduced to
                      one number. */}
                  <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                    <span className="font-semibold uppercase tracking-wide mr-1">
                      Source of confidence:
                    </span>
                    {describeConfidenceSource(confidenceSource)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recommended actions — quick-scan checklist tying each fix back to its issue */}
      {product.findings.length > 0 && (
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-bold text-navy">Recommended Actions</h2>
          <p className="text-xs text-muted-foreground -mt-1">
            Most critical first — see &quot;Findings &amp; Evidence&quot; above for full context on
            each.
          </p>
          <ul className="space-y-2.5">
            {sortFindingsBySeverity(product.findings).map((f: Finding) => (
              <li
                key={`action-${f.id}`}
                className={`flex items-start gap-2 text-sm p-2.5 rounded-lg bg-muted/30 border-l-4 ${f.severity === 'FLAG' ? 'border-l-flag' : 'border-l-review'}`}
              >
                <span
                  className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${f.severity === 'FLAG' ? 'bg-flag' : 'bg-review'}`}
                />
                <p className="leading-relaxed">
                  <span className="font-semibold text-navy">{f.title}</span>
                  <span className="text-muted-foreground"> — {f.recommendation}</span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Disclaimer */}
      <div className="card p-5 border-amber-200 bg-amber-50 space-y-2">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-review" />
          <p className="text-sm font-bold text-amber-900">Disclaimer</p>
        </div>
        <p className="text-xs text-amber-800 leading-relaxed">
          This report is generated by LabelGuard AI and is intended for informational and screening
          purposes only. It does not constitute legal certification, official compliance
          verification, or a substitute for inspection by a qualified authority. All findings are
          AI-assisted and require manual verification. Confidence values and readability estimates
          are approximations. AI-assisted screening — not an official legal certification.
          LabelGuard AI assumes no legal liability for decisions made based on this report.
        </p>
      </div>
    </div>
  );
}
