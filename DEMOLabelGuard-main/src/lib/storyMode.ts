import { getProductById } from '@/lib/mockData';

/**
 * Compliance Story Mode (Phase 3A).
 *
 * This file only DESCRIBES a walkthrough over the app's existing real
 * pages and existing demo products (see src/lib/mockData.ts). It does not
 * introduce any new product data, scores, or findings — every narration
 * line below references a real field on PRODUCT_B (NutriMax Oats), which
 * already ships in mockData.ts.
 *
 * Why NutriMax Oats (`product-b-001`) is the main story:
 * it is the only demo product with BOTH review and flag findings
 * (3 PASS / 2 REVIEW / 3 FLAG), so a single walkthrough can show the full
 * PASS → REVIEW → FLAG range without stitching together multiple
 * products into one confusing sequence. The compliant product
 * (Sunrise Basmati Rice) and the review-heavy product (CleanHome
 * Dishwash Gel) are offered as optional one-click "try another example"
 * links on the finish screen instead of being folded into the timed
 * walkthrough — see STORY_ALT_PRODUCTS below.
 */

export const STORY_PRODUCT_ID = 'product-b-001';

// The specific real finding Step 5 focuses on: Manufacturer Name, FLAG,
// 38% confidence — the lowest-confidence, most illustrative finding on
// the story product. Pulled directly from mockData.ts (decl-b-004).
export const STORY_FOCUS_DECLARATION_ID = 'decl-b-004';

export interface StoryAltProduct {
  id: string;
  label: string;
  badge: string;
}

// Optional "try another example" links shown on the finish screen only —
// not part of the timed walkthrough (see design note above).
export const STORY_ALT_PRODUCTS: StoryAltProduct[] = [
  { id: 'product-a-001', label: 'Sunrise Basmati Rice', badge: 'Compliant' },
  { id: 'product-c-001', label: 'CleanHome Dishwash Gel', badge: 'Needs review' },
];

export type StoryStepKind = 'intro' | 'page' | 'finish';

/** The six real, existing stages of the LabelGuard pipeline that Judge
 * Mode narrates in order: Scan → Analyze → Evidence → Compliance →
 * Report → Copilot. Purely a labeling/legend concern — every stage maps
 * to a real existing route, never a separate/fake flow. */
export type StoryStage = 'scan' | 'analyze' | 'evidence' | 'compliance' | 'report' | 'copilot';

export const STORY_STAGES: { key: StoryStage; label: string }[] = [
  { key: 'scan', label: 'Scan' },
  { key: 'analyze', label: 'Analyze' },
  { key: 'evidence', label: 'Evidence' },
  { key: 'compliance', label: 'Compliance' },
  { key: 'report', label: 'Report' },
  { key: 'copilot', label: 'Copilot' },
];

export interface StoryStep {
  id: string;
  kind: StoryStepKind;
  /** Pathname + query string to navigate to for this step, or null to
   * stay on whatever page the previous step landed on. */
  route: string | null;
  /** Which real pipeline stage this step demonstrates, for the Judge
   * Mode progress legend. Omitted for the intro/finish steps, which
   * aren't part of the pipeline itself. */
  stage?: StoryStage;
  narrationTitle: string;
  narration: string;
  /** How long this step is shown before auto-advancing, while playing
   * and not paused. */
  durationMs: number;
}

const productB = getProductById(STORY_PRODUCT_ID);
const focusDeclaration = productB?.declarations.find((d) => d.id === STORY_FOCUS_DECLARATION_ID);

export const STORY_STEPS: StoryStep[] = [
  {
    id: 'welcome',
    kind: 'intro',
    route: '/',
    narrationTitle: 'Welcome to LabelGuard',
    narration:
      "Welcome to LabelGuard. Let's see how a packaged product label gets checked for compliance — in under a minute.",
    durationMs: 6000,
  },
  {
    id: 'select-demo',
    kind: 'page',
    route: '/',
    stage: 'scan',
    narrationTitle: 'Scan: choosing a product',
    narration: `We'll use one of the built-in demo products — ${productB?.name ?? 'NutriMax Oats 500g'}. LabelGuard receives images of the front and back of the packaging.`,
    durationMs: 6000,
  },
  {
    id: 'analysis',
    kind: 'page',
    route: `/analysis?product=${STORY_PRODUCT_ID}&mode=demo`,
    stage: 'analyze',
    narrationTitle: 'Analyze: AI extraction',
    narration:
      'Now the AI extracts and checks mandatory declarations — product name, net quantity, MRP, manufacturer details, dates, and more.',
    durationMs: 8000,
  },
  {
    id: 'finding-focus',
    kind: 'page',
    route: `/compliance-map?product=${STORY_PRODUCT_ID}&finding=${STORY_FOCUS_DECLARATION_ID}`,
    stage: 'evidence',
    narrationTitle: 'Evidence: grounded in the label',
    narration: focusDeclaration
      ? `Every finding is tied to visible evidence on the label. Here, "${focusDeclaration.field}" was flagged — ${focusDeclaration.explanation}`
      : 'Every finding is tied to visible evidence on the label — the AI could not confidently locate this declaration.',
    durationMs: 9000,
  },
  {
    id: 'compliance-map',
    kind: 'page',
    route: `/compliance-map?product=${STORY_PRODUCT_ID}`,
    stage: 'compliance',
    narrationTitle: 'Compliance: the full picture',
    narration: `Zooming out: this label scored ${productB?.qualityScore ?? '–'}/100 — ${productB?.passCount ?? 0} declarations pass, ${productB?.reviewCount ?? 0} need review, and ${productB?.flagCount ?? 0} are flagged.`,
    durationMs: 8000,
  },
  {
    id: 'report',
    kind: 'page',
    route: `/report?product=${STORY_PRODUCT_ID}`,
    stage: 'report',
    narrationTitle: 'Report: ready to share',
    narration:
      'LabelGuard generates a full compliance report — score, summary, every finding, and recommended next steps — ready to share or export.',
    durationMs: 8000,
  },
  {
    id: 'copilot',
    kind: 'page',
    route: `/copilot?product=${STORY_PRODUCT_ID}`,
    stage: 'copilot',
    narrationTitle: 'Copilot: ask about the report',
    narration:
      'Finally, Ask LabelGuard can answer questions about this exact report — try asking "What should I fix first?" It only ever answers from this real data.',
    durationMs: 8000,
  },
  {
    id: 'finish',
    kind: 'finish',
    route: null,
    narrationTitle: "You've seen LabelGuard in action",
    narration: 'See the label. Understand the risk. Take action.',
    durationMs: 0,
  },
];

export const TOTAL_STORY_STEPS = STORY_STEPS.length;
