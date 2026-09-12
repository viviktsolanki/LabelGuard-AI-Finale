/**
 * Bharat Validator — engine entry point.
 *
 * This is the ONLY function the rest of the app should call. It takes the
 * trimmed set of AI-extracted fields it knows how to check (see
 * `BharatValidatorInput` in types.ts) and returns one `RuleValidationResult`
 * per field that actually had a non-empty value — never one for a field
 * that was empty/absent, since presence/mandatory-field decisions stay
 * with the existing logic in src/lib/realProduct.ts.
 *
 * Design (see TASK in the calling code for the full picture):
 *
 *   Gemini extracts/interprets (src/app/api/analyze/route.ts)
 *     → buildRealProductAnalysis() reads the raw extraction
 *       → existing confidence-threshold logic decides an initial
 *         PASS/REVIEW/FLAG per field (unchanged)
 *       → validateBharatCompliance() (this file) independently checks
 *         the STRUCTURE of the same extracted values
 *     → the two results are merged (src/lib/realProduct.ts): a
 *       validator FLAG/REVIEW on a field the AI-confidence path marked
 *       PASS downgrades that one declaration to REVIEW — mirroring the
 *       precedent already set by the existing AI-reported `conflict`
 *       downgrade — never the other way around, and never invented for
 *       a field the validator has no rule for.
 *     → existing PASS/REVIEW/FLAG UI renders both, clearly labeled.
 *
 * This module has no side effects, does no I/O, and calls no AI model —
 * it is pure, synchronous, and safe to call from client or server code.
 */

import { BHARAT_RULES } from './rules';
import type { BharatValidatorInput, RuleValidationResult } from './types';

export type {
  BharatValidatorField,
  BharatValidatorFieldKey,
  BharatValidatorInput,
  RuleValidationResult,
  RuleValidationStatus,
} from './types';
export { BHARAT_RULES } from './rules';

/**
 * Runs every deterministic Bharat Validator rule against the given
 * AI-extracted fields. Returns only results for fields with a non-empty
 * `value` — a missing/blank field produces no result here (see module
 * doc above for why).
 */
export function validateBharatCompliance(input: BharatValidatorInput): RuleValidationResult[] {
  const results: RuleValidationResult[] = [];

  for (const rule of BHARAT_RULES) {
    const field = input[rule.fieldKey];
    const value = (field?.value ?? '').toString().trim();
    if (!value) continue;

    const outcome = rule.check(value);

    results.push({
      fieldKey: rule.fieldKey,
      field: rule.field,
      ruleId: rule.ruleId,
      ruleCheck: rule.ruleCheck,
      status: outcome.status,
      message: outcome.message,
      checkedValue: value,
      source: 'RULE_VALIDATED',
    });
  }

  return results;
}

/** Convenience lookup: the validator result for one field key, if any. */
export function getBharatResultForField(
  results: RuleValidationResult[],
  fieldKey: RuleValidationResult['fieldKey']
): RuleValidationResult | null {
  return results.find((r) => r.fieldKey === fieldKey) ?? null;
}
