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

- Scan ("/"): Start a new inspection. Provide a Front and Back product image (both required) via drag/drop, file picker, or the device camera, plus up to 4 optional "Additional Views" for side panels, top, bottom, or close-ups of small text — useful when required info (like a batch number or license number) isn't on the front/back. Camera capture is responsive: on mobile it opens in a portrait-oriented frame (matching a phone's natural hold), on laptop/desktop it uses a wider landscape frame matching a webcam; the visible framing matches the captured photo. A "Demo Products" section offers 3 pre-loaded sample inspections that don't call the AI or require payment, for trying the product with example data.
- Video scanning ("/" — Video Scan option): Instead of separate photos, a user can upload or record a short video (up to 30 seconds) slowly rotating around the product. The app analyzes the video entirely in-browser: it samples candidate frames, scores each for sharpness and exposure (deprioritizing blurry or badly lit ones), and removes near-duplicate frames using perceptual-hash comparison. Up to about 6 distinct, usable frames are selected and fed into the exact same multi-image pipeline as manually captured photos — they are never treated as separate/unrelated products, only as different views of the one product being scanned. If the source video is genuinely poor quality throughout, the app still returns its best available frames along with an honest quality warning, rather than failing the scan.
- Multi-image analysis: Front, back, additional views, and/or video frames are all combined into one product record. Complementary information from different images is merged; if the same field appears clearly on more than one image, the clearest occurrence is used and it is not double-reported. If two images genuinely disagree on a critical field's value (e.g. batch number), that conflict is surfaced explicitly rather than silently picking one — a surfaced conflict downgrades that field from PASS to REVIEW. Information that isn't legibly visible in any image is left null/unknown rather than guessed.
- Payment flow (real scans only, not demo products): Capture/upload media → prepare it client-side → an x402 payment request for the paid analysis → pay 0.10 USDC on Algorand Testnet → payment is verified → the AI analysis runs → results are shown. This uses real Algorand Testnet transactions and Testnet USDC as a demonstration of the x402 payment protocol — it is not a real-money payment and carries no real-world financial guarantee. A compact receipt (transaction id, network, payer) is shown once payment settles, with a link to view the transaction on the Algorand Testnet explorer.
- Analysis ("/analysis?product=ID"): Shows the multi-view AI label extraction running/results right after a scan, including the payment step for real uploads.
- Compliance Map ("/compliance-map?product=ID"): The main results view. Shows the product's images with evidence overlays — bounding boxes drawn only where the AI supplied coordinates it was confident enough to report; when the AI couldn't confidently locate the evidence, no box is drawn rather than a fabricated/placeholder one. A per-finding detail panel shows the detected text, confidence, readability, which image/region the evidence came from, the compliance rule checked, why it was marked PASS/REVIEW/FLAG, and a recommended action. On smaller screens, a zoomed-in "evidence excerpt" (a crop of the source image around the evidence box) is shown inline with the finding so the user can see what the AI actually read without needing to pan the full image. There's a link from each finding to ask about it specifically via Ask LabelGuard.
- Bharat Validator: A separate, deterministic (non-AI) TypeScript rule layer that runs after Gemini extracts a field's value. It only checks the STRUCTURE/FORMAT of a value the AI already extracted — for example: whether a license number matches the standard 14-digit FSSAI format, whether net quantity has a number plus a recognized unit (e.g. "500 ml"), whether MRP includes a currency marker, whether the consumer-care field has a recognizable phone number or email, and similar structural checks on batch numbers and date fields. It does not call any AI model, does not decide whether a field is missing (that stays with the existing confidence-based logic), and never invents a rule or legal citation. If the validator finds a structural problem with a field the AI otherwise reported as PASS, that field is downgraded to REVIEW so a person double-checks it — the validator only ever downgrades from PASS to REVIEW, never escalates to FLAG and never overrides a status the AI-confidence logic already set.
- PASS / REVIEW / FLAG: Per-declaration compliance status, decided deterministically (never decided by the AI itself). The AI only supplies an extracted value and a confidence score; a field then starts as PASS at high confidence (≥80%), REVIEW at medium confidence (50-79%), and FLAG (if the field is mandatory) or REVIEW (if optional) below that or when nothing was detected at all. That initial status can then be downgraded — but never upgraded — from PASS to REVIEW if a genuine multi-image conflict was found for that field, or if the Bharat Validator found a structural problem with it. In short: PASS = information was clearly and confidently detected (and, if applicable, passed the structural rule check); REVIEW = the information is present but uncertain, borderline, or flagged by a rule for manual verification; FLAG = required information is missing, undetectable, or in genuine conflict across images. None of this is an official government or statutory certification — PASS never means "legally certified compliant" and FLAG never means "in legal violation," only that a human should look closer.
- Priority Action Plan (part of the Report): Each non-PASS finding is explained using the same three-part structure — what was found, why it matters, and what to do next. This is practical guidance, not professional legal advice.
- Report ("/report?product=ID"): Full compliance report for a product, including the Priority Action Plan and a smart summary. Can be exported as an editable TXT file or a genuine generated PDF (both built from the same report content).
- Compare ("/compare?product=ID"): Side-by-side comparison of two products' compliance results (works for real scans, demo products, or a mix).
- History ("/history"): List of previously analyzed products (real scans saved in this browser, plus demo history) with search.
- Story Mode: An optional guided walkthrough (available from the scan/homepage) that narrates a real demo product's PASS/REVIEW/FLAG findings end-to-end, for users who want a quick tour before scanning their own product.
- Real scans vs demo products: Real scans come from a user's own upload (and require the x402 payment step above), and are stored only in that browser (no backend database). Demo products are fixed sample data bundled with the app and skip both payment and the live AI call. They are never mixed.`;

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
