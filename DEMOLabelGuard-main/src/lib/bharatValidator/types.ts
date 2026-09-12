/**
 * Bharat Validator — shared types.
 *
 * The Bharat Validator is a deterministic, India-focused rule layer that
 * runs AFTER Gemini's extraction and ALONGSIDE the existing
 * confidence-threshold logic in src/lib/realProduct.ts. It never calls an
 * AI model and never overrides an AI-extracted value — it only checks the
 * STRUCTURE/FORMAT of values the AI already extracted against rules this
 * project already recognizes (see rules.ts for exactly which existing
 * rule each check maps to).
 *
 * This module is intentionally standalone: it does not import from
 * mockData.ts or realProduct.ts, so it has no dependency on the rest of
 * the app's types and can be unit-tested or reused on its own.
 */

export type RuleValidationStatus = 'PASS' | 'REVIEW' | 'FLAG';

/** Minimal per-field shape the validator needs — a trimmed mirror of the
 * AI extraction field shape already used in src/lib/realProduct.ts. */
export interface BharatValidatorField {
  value: string | null;
  /** 0-1, as returned by Gemini in /api/analyze. */
  confidence: number;
}

/** Only the fields the Bharat Validator has a deterministic check for.
 * Every key is optional — a field simply absent from the AI extraction
 * produces no validator result for it (never a fabricated failure). */
export interface BharatValidatorInput {
  license_numbers?: BharatValidatorField;
  net_quantity?: BharatValidatorField;
  mrp?: BharatValidatorField;
  customer_care?: BharatValidatorField;
  batch_number?: BharatValidatorField;
  manufacturing_date?: BharatValidatorField;
  packaging_date?: BharatValidatorField;
  expiry_date?: BharatValidatorField;
  use_by_date?: BharatValidatorField;
}

export type BharatValidatorFieldKey = keyof BharatValidatorInput;

/**
 * Outcome of one deterministic rule check against one AI-extracted field.
 * `source: 'RULE_VALIDATED'` is a constant discriminant so UI/report code
 * can tell this apart from a plain AI-detected value at a glance — the
 * "AI detected vs Rule validated" distinction the validator exists to
 * make explicit.
 */
export interface RuleValidationResult {
  fieldKey: BharatValidatorFieldKey;
  field: string;
  /**
   * Reuses the existing project ruleId/ruleCheck (see FIELD_SPECS in
   * src/lib/realProduct.ts, and the matching RULE-xxx ids already used in
   * src/lib/mockData.ts demo data) when this check corresponds to an
   * already-recognized declaration rule. A validator result is always
   * traceable back to an existing rule id, never a new unreviewed one.
   */
  ruleId: string;
  ruleCheck: string;
  status: RuleValidationStatus;
  /**
   * Plain-English reason for the status. Always describes a structural
   * check (format / presence-of-pattern / plausibility) — never a legal
   * citation or requirement this codebase doesn't already carry.
   */
  message: string;
  /** The exact value that was structurally evaluated. Null when there
   * was nothing to check (field absent/empty — see engine in index.ts). */
  checkedValue: string | null;
  source: 'RULE_VALIDATED';
}
