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
