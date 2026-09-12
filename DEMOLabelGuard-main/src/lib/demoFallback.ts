import { DEMO_PRODUCTS, getProductById, type Declaration, type ProductAnalysis } from './mockData';

/**
 * Server-only. Converts one of the app's existing, already-shipped demo
 * products (src/lib/mockData.ts — the same records shown in demo mode on
 * the homepage/analysis page) into the flat
 * `{ field: { value, source, confidence, evidence, conflict } }` shape
 * that /api/analyze normally returns from a real Gemini call.
 *
 * This is used ONLY as the explicit, opt-in emergency fallback
 * (?demo_fallback=true) — and only after a real Gemini attempt has
 * already exhausted its retry + configured-fallback attempts (see
 * src/lib/gemini.ts generateWithRetryAndFallback). It never invents new
 * label data: every value below is copied verbatim from an existing demo
 * product record that already ships with the app. Any schema field with
 * no corresponding demo declaration is left honestly null — never
 * guessed — exactly like a real Gemini response would leave an
 * unreadable field null.
 */

// Every /api/analyze demo product's declarations use one of these
// human-readable field labels (see mockData.ts). Mapping is intentionally
// a closed, explicit list — an unrecognised label is left unmapped
// rather than guessed at.
const FIELD_LABEL_TO_KEY: Record<string, string> = {
  'Product Name': 'product_name',
  'Net Quantity': 'net_quantity',
  MRP: 'mrp',
  'Manufacturer Name': 'manufacturer',
  'Manufacturer Address': 'manufacturer',
  'Best Before / Expiry': 'expiry_date',
  'Consumer Care': 'customer_care',
  'FSSAI Licence No.': 'license_numbers',
  'Batch / Lot Number': 'batch_number',
};

// Full field set /api/analyze's prompt schema promises the client, so a
// demo-fallback response always has the same shape as a real Gemini
// response. Fields with no demo-data equivalent stay null.
const SCHEMA_KEYS = [
  'product_name',
  'brand',
  'category',
  'net_quantity',
  'mrp',
  'batch_number',
  'manufacturing_date',
  'packaging_date',
  'expiry_date',
  'use_by_date',
  'ingredients',
  'manufacturer',
  'customer_care',
  'license_numbers',
  'warnings',
  'other_visible_declarations',
] as const;

interface SchemaField {
  value: string | null;
  source: string | null;
  confidence: number;
  evidence: { image: string; x: number; y: number; width: number; height: number } | null;
  conflict: string | null;
}

function emptyField(): SchemaField {
  return { value: null, source: null, confidence: 0, evidence: null, conflict: null };
}

/** Prefers a demo product whose category matches the requested upload's
 * category (so a "Food" upload that fails over gets a "Food" demo
 * record, not a mismatched one); falls back to the app's existing
 * default demo product otherwise. Never fabricates a product. */
function pickDemoProduct(category?: string | null): ProductAnalysis {
  const byCategory = category
    ? DEMO_PRODUCTS.find((p) => p.category.toLowerCase() === category.toLowerCase())
    : undefined;

  return byCategory ?? getProductById('product-b-001') ?? DEMO_PRODUCTS[0];
}

export interface DemoFallbackAnalysis {
  analysisJson: string;
  sourceProductId: string;
  sourceProductName: string;
}

export function buildDemoFallbackAnalysis(category?: string | null): DemoFallbackAnalysis {
  const product = pickDemoProduct(category);

  const fields: Record<string, SchemaField> = {};
  for (const key of SCHEMA_KEYS) {
    fields[key] = emptyField();
  }

  for (const decl of product.declarations as Declaration[]) {
    const key = FIELD_LABEL_TO_KEY[decl.field];
    if (!key) continue;

    const existing = fields[key];
    // Manufacturer name + address both map to "manufacturer" — combine
    // instead of letting the second overwrite the first.
    const value =
      key === 'manufacturer' && existing.value ? `${existing.value}, ${decl.value}` : decl.value;

    fields[key] = {
      value,
      source: decl.source ?? 'front',
      confidence: Math.max(0, Math.min(1, decl.confidence / 100)),
      evidence: decl.evidence
        ? {
            image: decl.evidence.image,
            x: decl.evidence.x,
            y: decl.evidence.y,
            width: decl.evidence.width,
            height: decl.evidence.height,
          }
        : null,
      conflict: null,
    };
  }

  return {
    analysisJson: JSON.stringify(fields),
    sourceProductId: product.id,
    sourceProductName: product.name,
  };
}
