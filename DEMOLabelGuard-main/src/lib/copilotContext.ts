import { type Declaration, type Finding, type ProductAnalysis } from '@/lib/mockData';

/**
 * Everything Ask LabelGuard is allowed to know about the product currently
 * open in the app. Built client-side (see copilot/page.tsx) because real
 * scans only live in this browser's localStorage — there is no backend
 * database to look them up from inside the API route. This is sent to
 * `/api/copilot` as structured JSON on every message; no images are ever
 * sent, and nothing here includes secrets, raw AI JSON, or pixel-level
 * evidence coordinates that the assistant doesn't need to answer in words.
 */
export interface CopilotDeclarationContext {
  id: string;
  field: string;
  value: string;
  confidence: number;
  status: Declaration['status'];
  sourceRegion: string;
  ruleCheck: string;
  explanation: string;
  recommendedAction: string;
}

export interface CopilotFindingContext {
  id: string;
  declarationId: string;
  title: string;
  severity: Finding['severity'];
  reason: string;
  explanation: string;
  recommendation: string;
}

export interface CopilotProductContext {
  productId: string;
  productName: string;
  category: string;
  /** Whether this is a real user-uploaded scan or a bundled demo product. */
  isRealScan: boolean;
  analyzedAt: string;
  qualityScore: number;
  overallStatus: 'PASS' | 'REVIEW' | 'FLAG';
  passCount: number;
  reviewCount: number;
  flagCount: number;
  /** Declaration id the user arrived to ask about specifically, if any. */
  focusDeclarationId?: string;
  declarations: CopilotDeclarationContext[];
  findings: CopilotFindingContext[];
}

const MAX_TEXT_LEN = 600;

const clip = (value: string | null | undefined): string =>
  (value ?? '').toString().slice(0, MAX_TEXT_LEN);

/**
 * Builds the compact, structured context sent to the assistant for a given
 * product. Deliberately excludes: image URLs/data, pixel-level evidence
 * boxes, and `rawAiExtraction` (opaque raw model JSON) — none of those are
 * needed to answer in words, and skipping them keeps the request small.
 */
export const buildProductContext = (
  product: ProductAnalysis,
  isRealScan: boolean,
  focusDeclarationId?: string | null
): CopilotProductContext => {
  const overallStatus: 'PASS' | 'REVIEW' | 'FLAG' =
    product.flagCount > 0 ? 'FLAG' : product.reviewCount > 0 ? 'REVIEW' : 'PASS';

  return {
    productId: product.id,
    productName: product.name,
    category: product.category,
    isRealScan,
    analyzedAt: product.analyzedAt,
    qualityScore: product.qualityScore,
    overallStatus,
    passCount: product.passCount,
    reviewCount: product.reviewCount,
    flagCount: product.flagCount,
    focusDeclarationId: focusDeclarationId || undefined,
    declarations: product.declarations.map((d) => ({
      id: d.id,
      field: d.field,
      value: clip(d.value || d.extractedText),
      confidence: d.confidence,
      status: d.status,
      sourceRegion: d.sourceRegion,
      ruleCheck: d.ruleCheck,
      explanation: clip(d.explanation),
      recommendedAction: clip(d.recommendedAction),
    })),
    findings: product.findings.map((f) => ({
      id: f.id,
      declarationId: f.declarationId,
      title: f.title,
      severity: f.severity,
      reason: clip(f.reason),
      explanation: clip(f.explanation),
      recommendation: clip(f.recommendation),
    })),
  };
};

/** A finding/declaration pair the user asked about specifically, e.g. via
 * the "Ask LabelGuard about this finding" link from the Compliance Map. */
export interface FocusFinding {
  declaration: Declaration;
  finding: Finding | null;
}

/**
 * Resolves a `?finding=` id against a product's declarations/findings. The
 * id may refer to either a declaration id or a finding id depending on
 * which UI element linked here. Returns null (never a silent fallback to
 * an unrelated declaration) when the id doesn't match anything on this
 * product.
 */
export const resolveFocusFinding = (
  product: ProductAnalysis,
  findingId: string | null | undefined
): FocusFinding | null => {
  if (!findingId) return null;

  const byDeclaration = product.declarations.find((d) => d.id === findingId);
  if (byDeclaration) {
    const finding = product.findings.find((f) => f.declarationId === byDeclaration.id) || null;
    return { declaration: byDeclaration, finding };
  }

  const byFinding = product.findings.find((f) => f.id === findingId);
  if (byFinding) {
    const declaration = product.declarations.find((d) => d.id === byFinding.declarationId);
    return declaration ? { declaration, finding: byFinding } : null;
  }

  return null;
};

/**
 * Concise, accurate description of what LabelGuard actually does and where
 * — built from inspecting the real routes/components, not guessed. Kept
 * short and factual on purpose: the assistant should only ever describe
 * features that exist here, never invent capabilities.
 */
export const WEBSITE_KNOWLEDGE = `LabelGuard AI features and routes (only describe what's listed here):

- Scan ("/"): Start a new inspection. Upload a Front and Back product image (drag/drop or file picker) or capture them with the device camera. Up to 4 optional "Additional Views" can be added for side panels, top, bottom, or close-ups of small text — useful when required info (like a batch number or license number) isn't on the front/back. A "Demo Products" section offers 3 pre-loaded sample inspections that don't call the AI or require payment, for trying the product with example data.
- Analysis ("/analysis?product=ID"): Shows the multi-view AI label extraction running/results right after a scan.
- Compliance Map ("/compliance-map?product=ID"): The main results view. Shows the product's images with evidence overlays, a per-finding detail panel (detected text, confidence, readability, which image/region the evidence came from, the compliance rule checked, why it was marked PASS/REVIEW/FLAG, and a recommended action), and a link to ask about that specific finding.
- Report ("/report?product=ID"): Full compliance report for a product. Can be exported as an editable TXT file or a real PDF.
- Compare ("/compare?product=ID"): Side-by-side comparison of two products' compliance results (works for real scans, demo products, or a mix).
- History ("/history"): List of previously analyzed products (real scans saved in this browser, plus demo history) with search.
- PASS / REVIEW / FLAG: Per-declaration compliance status. FLAG = a mandatory piece of label info wasn't detected (or was detected with very low confidence). REVIEW = the info was detected but with lower confidence, or an optional field is missing. PASS = detected with high confidence. The AI only extracts values and confidence — the PASS/REVIEW/FLAG decision itself is deterministic, not decided by the AI.
- Real scans vs demo products: Real scans come from a user's own upload and are stored only in that browser (no backend database). Demo products are fixed sample data bundled with the app. They are never mixed.`;

const NAV_VERB =
  /^(take me to|go to|open|show me|navigate to|where (is|can i find|do i)|let'?s (go to|see)|bring me to|pull up)\b/i;

interface NavTarget {
  label: string;
  keywords: RegExp;
  buildHref: (productId?: string | null) => string;
}

const NAV_TARGETS: NavTarget[] = [
  {
    label: 'the Compliance Map',
    keywords: /compliance map/i,
    buildHref: (pid) => (pid ? `/compliance-map?product=${pid}` : '/compliance-map'),
  },
  {
    label: 'your Report',
    keywords: /\breport\b/i,
    buildHref: (pid) => (pid ? `/report?product=${pid}` : '/report'),
  },
  {
    label: 'Compare',
    keywords: /\bcompare\b/i,
    buildHref: (pid) => (pid ? `/compare?product=${pid}` : '/compare'),
  },
  {
    label: 'your Scan History',
    keywords: /\bhistory\b|previous scans?/i,
    buildHref: () => '/history',
  },
  {
    label: 'a new scan',
    keywords: /new scan|start.*scan|scan a (new )?product/i,
    buildHref: () => '/',
  },
  {
    label: 'the Analysis view',
    keywords: /\banalysis\b/i,
    buildHref: (pid) => (pid ? `/analysis?product=${pid}` : '/analysis'),
  },
];

export interface NavigationIntent {
  label: string;
  href: string;
}

/**
 * Deterministic, non-AI detection of a small set of clear "take me to X"
 * navigation requests, matched against the app's real routes only. Kept
 * separate from the AI call so navigation can never point somewhere that
 * doesn't exist — anything that isn't a clear navigational phrase (e.g.
 * "how do I download my report?") falls through to the assistant instead.
 */
export const detectNavigationIntent = (
  message: string,
  productId?: string | null
): NavigationIntent | null => {
  const trimmed = message.trim();
  if (!NAV_VERB.test(trimmed)) return null;

  for (const target of NAV_TARGETS) {
    if (target.keywords.test(trimmed)) {
      return { label: target.label, href: target.buildHref(productId) };
    }
  }

  return null;
};
