/**
 * Phase 4A — Deterministic Report Intelligence
 *
 * Reusable helpers that derive higher-level insights (summary, priority
 * action plan, strongest/weakest area) purely from the existing
 * `ProductAnalysis` object. No AI calls, no new data, no re-implementation
 * of score/status calculation — this only reads and organizes data that
 * `realProduct.ts` / `mockData.ts` already produced.
 */

import type {
  ProductAnalysis,
  Finding,
  Declaration,
  ComplianceScoreBreakdown,
  DeclarationStatus,
} from './mockData';

export type OverallComplianceStatus = 'COMPLIANT' | 'NEEDS REVIEW' | 'NON-COMPLIANT';

export interface PriorityAction {
  id: string;
  issue: string;
  status: DeclarationStatus;
  recommendation: string;
  /** Declaration field this action relates to, if it could be resolved. */
  declarationField?: string;
  /** Why this was flagged/reviewed — sourced from the finding's existing
   * `explanation` field, so the plan can show "why it matters" alongside
   * the recommendation without any new analysis or fabricated text. */
  explanation?: string;
  /** Where the evidence for this finding sits (e.g. "Front panel") —
   * the finding's own existing `evidenceRegion` field, unchanged. */
  evidenceRegion?: string;
  /** Trust/explainability breakdown for this finding — see
   * `getConfidenceSource` below. Purely derived from existing fields. */
  confidenceSource?: ConfidenceSource;
}

/**
 * Trust/explainability breakdown for a single finding, distinguishing the
 * three things that actually produced the result — so the UI can show
 * "source of confidence" honestly instead of a single opaque percentage:
 *
 * - aiDetected: whether the vision model extracted a value at all, and
 *   at what confidence (0 when nothing was extracted).
 * - ruleValidated: whether the deterministic Bharat Validator (see
 *   src/lib/bharatValidator) actually ran a structural/format check
 *   against this declaration's extracted value — i.e. `validatorCheck` is
 *   present. This is intentionally NOT the same as `finding.ruleId`,
 *   which is the field's always-present declaration-category id (e.g.
 *   "RULE-002: Net quantity declaration") set for every field regardless
 *   of whether any deterministic check ran; using that would claim every
 *   finding was "rule validated" even when no structural rule matched.
 *   `ruleId`/`ruleCheck` below are the Bharat Validator's own identifiers
 *   (e.g. "RULE-005b: Expiry date format"), not the field's category id.
 * - evidenceLocated: whether a real, AI-located bounding box exists for
 *   this declaration on one of the submitted images. False (never
 *   fabricated) for demo products and for any real-upload field the AI
 *   could not confidently place on the image — see `sanitizeEvidence` in
 *   realProduct.ts, which returns null rather than a guessed box.
 *
 * Every field here is read from data `realProduct.ts`/`mockData.ts`
 * already computed; nothing new is inferred or scored.
 */
export interface ConfidenceSource {
  aiDetected: boolean;
  aiConfidence: number;
  ruleValidated: boolean;
  ruleId?: string;
  ruleCheck?: string;
  evidenceLocated: boolean;
}

const NOT_DETECTED_TEXT = 'Not confidently detected';

/** Builds the trust breakdown for one finding from existing fields only.
 * `declaration` is optional since callers that only have a `Finding` (no
 * resolved `Declaration`) can still get the AI-detected part — both rule
 * validation and evidence location depend on the declaration's own
 * `validatorCheck`/`evidence` fields, so they're honestly reported as
 * absent (never guessed) when the declaration isn't available. */
export function getConfidenceSource(
  finding: Finding,
  declaration?: Declaration | null
): ConfidenceSource {
  const validatorCheck = declaration?.validatorCheck;
  return {
    aiDetected: finding.detectedText !== NOT_DETECTED_TEXT && finding.confidence > 0,
    aiConfidence: finding.confidence,
    ruleValidated: Boolean(validatorCheck),
    ruleId: validatorCheck?.ruleId,
    ruleCheck: validatorCheck?.ruleCheck,
    evidenceLocated: Boolean(declaration?.evidence),
  };
}

/** Compact, single-line description of a `ConfidenceSource` — used by the
 * report's on-screen, PDF, and plain-text exports so the wording stays
 * identical across all three. */
export function describeConfidenceSource(source: ConfidenceSource): string {
  const parts: string[] = [
    source.aiDetected ? `AI detected (${source.aiConfidence}% confidence)` : 'Not detected by AI',
    source.ruleValidated
      ? `Rule validated (${source.ruleCheck || source.ruleId})`
      : 'No deterministic rule matched',
    source.evidenceLocated ? 'Evidence located on image' : 'Evidence not pinpointed on image',
  ];
  return parts.join(' · ');
}

export interface PriorityActionPlan {
  priority1: PriorityAction[]; // Critical — FLAG findings
  priority2: PriorityAction[]; // Important — REVIEW findings
  priority3: PriorityAction[]; // Recommended — genuinely useful PASS-level recommendations, if any exist
}

export interface ScoreAreaInsight {
  label: string;
  value: number;
}

export interface ComplianceInsights {
  overallStatus: OverallComplianceStatus;
  overallScore: number;
  passCount: number;
  reviewCount: number;
  flagCount: number;
  mostCriticalIssue: Finding | null;
  recommendedNextAction: string;
  strongestArea: ScoreAreaInsight | null;
  weakestArea: ScoreAreaInsight | null;
  priorityActionPlan: PriorityActionPlan;
}

const SCORE_AREA_LABELS: Record<keyof ComplianceScoreBreakdown, string> = {
  mandatoryDeclarations: 'Mandatory Declarations',
  readability: 'Readability',
  extractionConfidence: 'Extraction Confidence',
  placementVisibility: 'Placement / Visibility',
  labelConsistency: 'Label Consistency',
};

const GENERIC_PASS_RECOMMENDATION = 'no action required.';

/** Overall status derived from existing PASS/REVIEW/FLAG counts only. */
export function getOverallStatus(product: ProductAnalysis): OverallComplianceStatus {
  if (product.flagCount > 0) return 'NON-COMPLIANT';
  if (product.reviewCount > 0) return 'NEEDS REVIEW';
  return 'COMPLIANT';
}

/**
 * Most critical real finding: FLAG findings take priority over REVIEW.
 * Within the same severity, lower confidence acts as the tie-breaker
 * (a less-confidently-extracted issue is treated as more concerning).
 * Returns null when there are no findings — never fabricates one.
 */
export function getMostCriticalIssue(product: ProductAnalysis): Finding | null {
  const flags = product.findings.filter((f) => f.severity === 'FLAG');
  const reviews = product.findings.filter((f) => f.severity === 'REVIEW');
  const pool = flags.length > 0 ? flags : reviews;
  if (pool.length === 0) return null;

  return [...pool].sort((a, b) => a.confidence - b.confidence)[0];
}

/** Recommended next action text, sourced from the most critical finding's
 * own recommendation when one exists. */
export function getRecommendedNextAction(product: ProductAnalysis): string {
  const critical = getMostCriticalIssue(product);
  if (critical) return critical.recommendation;

  return 'No further action required — all mandatory declarations passed compliance checks.';
}

/** Highest-scoring area of the existing score breakdown. */
export function getStrongestArea(product: ProductAnalysis): ScoreAreaInsight | null {
  const entries = Object.entries(product.scoreBreakdown) as [
    keyof ComplianceScoreBreakdown,
    number,
  ][];
  if (entries.length === 0) return null;
  const best = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  return { label: SCORE_AREA_LABELS[best[0]], value: best[1] };
}

/** Lowest-scoring area of the existing score breakdown. */
export function getWeakestArea(product: ProductAnalysis): ScoreAreaInsight | null {
  const entries = Object.entries(product.scoreBreakdown) as [
    keyof ComplianceScoreBreakdown,
    number,
  ][];
  if (entries.length === 0) return null;
  const worst = entries.reduce((a, b) => (b[1] < a[1] ? b : a));
  return { label: SCORE_AREA_LABELS[worst[0]], value: worst[1] };
}

function findDeclarationForFinding(
  product: ProductAnalysis,
  finding: Finding
): Declaration | undefined {
  return product.declarations.find((d) => d.id === finding.declarationId);
}

function toPriorityAction(product: ProductAnalysis, finding: Finding): PriorityAction {
  const declaration = findDeclarationForFinding(product, finding);
  return {
    id: finding.id,
    issue: finding.title,
    status: finding.severity,
    recommendation: finding.recommendation,
    declarationField: declaration?.field,
    explanation: finding.explanation,
    evidenceRegion: finding.evidenceRegion,
    confidenceSource: getConfidenceSource(finding, declaration),
  };
}

/**
 * Deterministic priority action plan built only from real findings:
 * Priority 1 = FLAG findings, Priority 2 = REVIEW findings.
 * Priority 3 would hold PASS-level findings with a genuinely useful
 * (non-generic) recommendation — the current analysis pipeline only ever
 * creates findings for non-PASS declarations, so this is empty today
 * rather than padded with fabricated entries; it's kept so the plan stays
 * correct if that ever changes.
 */
export function buildPriorityActionPlan(product: ProductAnalysis): PriorityActionPlan {
  const priority1 = product.findings
    .filter((f) => f.severity === 'FLAG')
    .map((f) => toPriorityAction(product, f));

  const priority2 = product.findings
    .filter((f) => f.severity === 'REVIEW')
    .map((f) => toPriorityAction(product, f));

  const priority3 = product.findings
    .filter(
      (f) =>
        f.severity === 'PASS' &&
        f.recommendation &&
        f.recommendation.trim().toLowerCase() !== GENERIC_PASS_RECOMMENDATION
    )
    .map((f) => toPriorityAction(product, f));

  return { priority1, priority2, priority3 };
}

/** Single entry point bundling all Phase 4A insights for a product. */
export function getComplianceInsights(product: ProductAnalysis): ComplianceInsights {
  return {
    overallStatus: getOverallStatus(product),
    overallScore: product.qualityScore,
    passCount: product.passCount,
    reviewCount: product.reviewCount,
    flagCount: product.flagCount,
    mostCriticalIssue: getMostCriticalIssue(product),
    recommendedNextAction: getRecommendedNextAction(product),
    strongestArea: getStrongestArea(product),
    weakestArea: getWeakestArea(product),
    priorityActionPlan: buildPriorityActionPlan(product),
  };
}
