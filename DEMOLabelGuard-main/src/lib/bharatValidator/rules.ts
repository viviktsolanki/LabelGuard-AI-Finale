/**
 * Bharat Validator — deterministic per-field rule definitions.
 *
 * Every rule here is a pure STRUCTURAL/FORMAT check on a value the AI
 * (Gemini, via /api/analyze) already extracted. Rules never:
 *   - call an AI model,
 *   - invent a legal citation this project doesn't already carry, or
 *   - decide that a field is "missing" (presence/mandatory-field logic
 *     stays exactly where it already lives, in FIELD_SPECS /
 *     statusFor() in src/lib/realProduct.ts).
 *
 * Where a check maps to a declaration the project already recognizes,
 * `ruleId`/`ruleCheck` reuse the EXACT identifiers already used for that
 * field — `fssai_required` / `RULE-007` already exists in
 * src/lib/mockData.ts demo data; the others mirror the FIELD_SPECS ids in
 * src/lib/realProduct.ts. Nothing here introduces a new legal rule number.
 *
 * A rule's `check` runs only when the field has a non-empty value. Adding
 * a new rule = adding one object below; nothing else needs to change.
 */

import { isPlausibleLabelDate } from './dateFormats';
import type { BharatValidatorFieldKey, RuleValidationStatus } from './types';

export interface RuleCheckOutcome {
  status: RuleValidationStatus;
  message: string;
}

export interface BharatRule {
  fieldKey: BharatValidatorFieldKey;
  field: string;
  ruleId: string;
  ruleCheck: string;
  check: (value: string) => RuleCheckOutcome;
}

// Known non-answers the AI (or a label) sometimes returns instead of a
// real value — these should never be scored as a plausible-looking value.
const PLACEHOLDER_PATTERN = /^(n\/?a|not applicable|none|-+|not confidently detected)$/i;

// ── FSSAI licence number format ─────────────────────────────────────────
// A 14-digit FSSAI licence/registration number is a widely published,
// long-standing numbering convention (the same 14-digit format already
// shown in this project's own demo data, e.g. "FSSAI Lic. No.
// 10016011008833" in src/lib/mockData.ts). This check only confirms that
// shape is present — it does not validate the number against FSSAI's
// live database, and it does not assert any requirement beyond the
// digit-count format already implied by that existing demo data.
const fssaiLicenceRule: BharatRule = {
  fieldKey: 'license_numbers',
  field: 'License Numbers',
  ruleId: 'fssai_required',
  ruleCheck: 'RULE-007: FSSAI licence declaration',
  check: (value) => {
    const digitsOnly = value.replace(/[\s-]/g, '');
    if (/\d{14}/.test(digitsOnly)) {
      return {
        status: 'PASS',
        message: 'Matches the standard 14-digit FSSAI licence number format.',
      };
    }
    if (/fssai/i.test(value)) {
      return {
        status: 'REVIEW',
        message:
          'References FSSAI but no 14-digit licence number could be confirmed in the extracted text — verify manually.',
      };
    }
    return {
      status: 'REVIEW',
      message:
        'Value does not match the standard 14-digit FSSAI licence number format — verify manually.',
    };
  },
};

// ── Net quantity format ─────────────────────────────────────────────────
const NET_QUANTITY_PATTERN =
  /^\s*\d+(\.\d+)?\s*(kg|g|gm|gms|mg|l|ltr|litre|litres|ml|pcs|pieces|piece|nos|no\.?|units?)\b/i;

const netQuantityRule: BharatRule = {
  fieldKey: 'net_quantity',
  field: 'Net Quantity',
  ruleId: 'net_quantity_required',
  ruleCheck: 'RULE-002: Net quantity declaration',
  check: (value) => {
    if (PLACEHOLDER_PATTERN.test(value.trim())) {
      return {
        status: 'REVIEW',
        message:
          'Value looks like a placeholder rather than an actual net quantity — verify manually.',
      };
    }
    if (NET_QUANTITY_PATTERN.test(value.trim())) {
      return {
        status: 'PASS',
        message: 'Matches a numeric amount plus a standard unit (e.g. "500 ml", "1 kg").',
      };
    }
    return {
      status: 'REVIEW',
      message:
        'Value does not match a clear <number><unit> pattern (e.g. "500 ml", "1 kg") — verify manually.',
    };
  },
};

// ── MRP format ───────────────────────────────────────────────────────────
const CURRENCY_PATTERN = /(₹|rs\.?|inr)\s*\d/i;
const ANY_DIGIT_PATTERN = /\d/;

const mrpRule: BharatRule = {
  fieldKey: 'mrp',
  field: 'MRP',
  ruleId: 'mrp_required',
  ruleCheck: 'RULE-003: MRP declaration',
  check: (value) => {
    if (CURRENCY_PATTERN.test(value)) {
      return {
        status: 'PASS',
        message: 'Includes a currency marker (₹ / Rs. / INR) alongside a numeric amount.',
      };
    }
    if (ANY_DIGIT_PATTERN.test(value)) {
      return {
        status: 'REVIEW',
        message:
          'Numeric amount present but no currency marker (₹ / Rs. / INR) detected — verify manually.',
      };
    }
    return {
      status: 'REVIEW',
      message: 'Value does not contain a recognizable price amount — verify manually.',
    };
  },
};

// ── Consumer care contact format ────────────────────────────────────────
const PHONE_PATTERN = /(\+?91[-\s]?)?\b[6-9]\d{9}\b|\b1[-\s]?800[-\s]?\d{3,4}[-\s]?\d{3,4}\b/;
const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/;

const consumerCareRule: BharatRule = {
  fieldKey: 'customer_care',
  field: 'Consumer Care',
  ruleId: 'consumer_care_required',
  ruleCheck: 'RULE-006: Consumer care declaration',
  check: (value) => {
    if (PHONE_PATTERN.test(value) || EMAIL_PATTERN.test(value)) {
      return {
        status: 'PASS',
        message: 'Matches a recognizable phone number or email address format.',
      };
    }
    return {
      status: 'REVIEW',
      message:
        'Value does not match a recognizable phone number or email format — verify manually.',
    };
  },
};

// ── Batch / lot number plausibility ─────────────────────────────────────
const batchNumberRule: BharatRule = {
  fieldKey: 'batch_number',
  field: 'Batch / Lot Number',
  ruleId: 'batch_required',
  ruleCheck: 'RULE-008: Batch / lot number declaration',
  check: (value) => {
    const trimmed = value.trim();
    if (PLACEHOLDER_PATTERN.test(trimmed)) {
      return {
        status: 'REVIEW',
        message:
          'Value looks like a placeholder rather than an actual batch/lot code — verify manually.',
      };
    }
    if (trimmed.length < 3) {
      return {
        status: 'REVIEW',
        message: 'Value is unusually short for a batch/lot code — verify manually.',
      };
    }
    if (!ANY_DIGIT_PATTERN.test(trimmed)) {
      return {
        status: 'REVIEW',
        message:
          'Value contains no digits, which is unusual for a batch/lot code — verify manually.',
      };
    }
    return {
      status: 'PASS',
      message: 'Has a plausible alphanumeric batch/lot code shape.',
    };
  },
};

// ── Date fields — structural parseability only ──────────────────────────
const dateCheck = (value: string): RuleCheckOutcome => {
  const trimmed = value.trim();
  if (PLACEHOLDER_PATTERN.test(trimmed)) {
    return {
      status: 'REVIEW',
      message: 'Value looks like a placeholder rather than an actual date — verify manually.',
    };
  }
  if (isPlausibleLabelDate(trimmed)) {
    return {
      status: 'PASS',
      message: 'Parses as a valid calendar date in a recognized label format.',
    };
  }
  return {
    status: 'REVIEW',
    message:
      'Value does not match a recognized date format (e.g. DD/MM/YYYY, MM/YYYY, DD MMM YYYY) — verify manually.',
  };
};

const expiryDateRule: BharatRule = {
  fieldKey: 'expiry_date',
  field: 'Best Before / Expiry',
  ruleId: 'date_required',
  ruleCheck: 'RULE-005: Best before / expiry declaration',
  check: dateCheck,
};

const manufacturingDateRule: BharatRule = {
  fieldKey: 'manufacturing_date',
  field: 'Manufacturing Date',
  ruleId: 'mfg_date_optional',
  ruleCheck: 'RULE-011: Manufacturing date',
  check: dateCheck,
};

const packagingDateRule: BharatRule = {
  fieldKey: 'packaging_date',
  field: 'Packaging Date',
  ruleId: 'packaging_date_optional',
  ruleCheck: 'RULE-011b: Packaging date',
  check: dateCheck,
};

const useByDateRule: BharatRule = {
  fieldKey: 'use_by_date',
  field: 'Use By Date',
  ruleId: 'use_by_date_optional',
  ruleCheck: 'RULE-011c: Use by date',
  check: dateCheck,
};

/** All Bharat Validator rules. Add new deterministic checks here — the
 * engine in index.ts iterates this list unchanged. */
export const BHARAT_RULES: BharatRule[] = [
  fssaiLicenceRule,
  netQuantityRule,
  mrpRule,
  consumerCareRule,
  batchNumberRule,
  expiryDateRule,
  manufacturingDateRule,
  packagingDateRule,
  useByDateRule,
];
