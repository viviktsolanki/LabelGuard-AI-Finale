import {
  isAdditionalImageId,
  imageLabelFor,
  getProductById,
  type AdditionalImage,
  type AdditionalImageId,
  type ComplianceScoreBreakdown,
  type Declaration,
  type DeclarationStatus,
  type EvidenceRegion,
  type Finding,
  type ImageId,
  type ProductAnalysis,
} from '@/lib/mockData';

/**
 * Real-upload products are stored under this storage key prefix and
 * their id always starts with REAL_UPLOAD_ID_PREFIX so the compliance map
 * (and any other page keyed by product id) can tell a real upload apart
 * from a `mockData.ts` demo product id such as `product-b-001`.
 */
export const REAL_UPLOAD_ID_PREFIX = 'real-upload-';

const STORAGE_KEY_PREFIX = 'labelguard:real-product:';

/**
 * Ordered index of real-upload product ids (most recently saved first).
 * Kept as its own small key so History/Compare can list every real
 * product without scanning all of localStorage.
 */
const INDEX_KEY = 'labelguard:real-product-index';

/** One-time migration guard so old sessionStorage data (from before real
 * products persisted across a refresh) is copied into localStorage once,
 * rather than on every read. */
const MIGRATION_FLAG_KEY = 'labelguard:real-product-migrated-v2';

export const isRealUploadId = (id: string | null | undefined): boolean =>
  typeof id === 'string' && id.startsWith(REAL_UPLOAD_ID_PREFIX);

const hasWindow = (): boolean => typeof window !== 'undefined';

const readIndex = (): string[] => {
  if (!hasWindow()) return [];
  try {
    const raw = window.localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
};

const writeIndex = (ids: string[]): void => {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(INDEX_KEY, JSON.stringify(ids));
  } catch (error) {
    console.error('Unable to persist real-product index:', error);
  }
};

/**
 * Real products previously lived only in sessionStorage, which is cleared
 * on refresh in some browsers/tabs and never shared across tabs. This
 * copies any legacy sessionStorage entries into localStorage (and rebuilds
 * the index) exactly once, so existing real-upload ids keep working.
 */
const migrateLegacyStorage = (): void => {
  if (!hasWindow()) return;

  try {
    if (window.localStorage.getItem(MIGRATION_FLAG_KEY)) return;

    const migratedIds: string[] = [];

    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (!key || !key.startsWith(STORAGE_KEY_PREFIX)) continue;

      const id = key.slice(STORAGE_KEY_PREFIX.length);
      const raw = window.sessionStorage.getItem(key);
      if (!raw) continue;

      // Don't clobber a newer localStorage copy that might already exist.
      if (!window.localStorage.getItem(key)) {
        window.localStorage.setItem(key, raw);
      }

      migratedIds.push(id);
    }

    if (migratedIds.length) {
      const existing = readIndex();
      const merged = [...new Set([...migratedIds, ...existing])];
      writeIndex(merged);
    }

    window.localStorage.setItem(MIGRATION_FLAG_KEY, '1');
  } catch (error) {
    // Migration is best-effort only — never block the app on it.
    console.error('Real-product storage migration failed:', error);
  }
};

/** Raw evidence shape returned by the /api/analyze real AI vision endpoint. */
interface AiEvidence {
  image: ImageId;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Raw shape returned by the /api/analyze real AI vision endpoint. */
interface AiField {
  value: string | null;
  source: ImageId | 'both' | null;
  confidence: number; // 0-1
  evidence?: AiEvidence | null;
  /**
   * Short human-readable description of a genuine disagreement between
   * images for this field (e.g. two different batch numbers were read on
   * two views). Null/absent when every image agreed. The AI reports the
   * conflict; the app (not the AI) decides how that affects status below.
   */
  conflict?: string | null;
}

type AiExtraction = Record<string, AiField | undefined>;

interface FieldSpec {
  key: string;
  field: string;
  ruleId: string;
  ruleCheck: string;
  mandatory: boolean;
}

// Mirrors the JSON schema requested from the model in /api/analyze.
const FIELD_SPECS: FieldSpec[] = [
  { key: 'product_name', field: 'Product Name', ruleId: 'product_name_required', ruleCheck: 'RULE-001: Product name declaration', mandatory: true },
  { key: 'net_quantity', field: 'Net Quantity', ruleId: 'net_quantity_required', ruleCheck: 'RULE-002: Net quantity declaration', mandatory: true },
  { key: 'mrp', field: 'MRP', ruleId: 'mrp_required', ruleCheck: 'RULE-003: MRP declaration', mandatory: true },
  { key: 'manufacturer', field: 'Manufacturer', ruleId: 'manufacturer_required', ruleCheck: 'RULE-004: Manufacturer declaration', mandatory: true },
  { key: 'expiry_date', field: 'Best Before / Expiry', ruleId: 'date_required', ruleCheck: 'RULE-005: Best before / expiry declaration', mandatory: true },
  { key: 'customer_care', field: 'Consumer Care', ruleId: 'consumer_care_required', ruleCheck: 'RULE-006: Consumer care declaration', mandatory: true },
  { key: 'batch_number', field: 'Batch / Lot Number', ruleId: 'batch_required', ruleCheck: 'RULE-008: Batch / lot number declaration', mandatory: true },
  { key: 'brand', field: 'Brand', ruleId: 'brand_optional', ruleCheck: 'RULE-010: Brand name', mandatory: false },
  { key: 'manufacturing_date', field: 'Manufacturing Date', ruleId: 'mfg_date_optional', ruleCheck: 'RULE-011: Manufacturing date', mandatory: false },
  { key: 'packaging_date', field: 'Packaging Date', ruleId: 'packaging_date_optional', ruleCheck: 'RULE-011b: Packaging date', mandatory: false },
  { key: 'use_by_date', field: 'Use By Date', ruleId: 'use_by_date_optional', ruleCheck: 'RULE-011c: Use by date', mandatory: false },
  { key: 'ingredients', field: 'Ingredients', ruleId: 'ingredients_optional', ruleCheck: 'RULE-012: Ingredients declaration', mandatory: false },
  { key: 'license_numbers', field: 'License Numbers', ruleId: 'license_optional', ruleCheck: 'RULE-013: License number declaration', mandatory: false },
  { key: 'warnings', field: 'Warnings', ruleId: 'warnings_optional', ruleCheck: 'RULE-014: Warning statements', mandatory: false },
  { key: 'other_visible_declarations', field: 'Other Declarations', ruleId: 'other_optional', ruleCheck: 'RULE-015: Other visible declarations', mandatory: false },
];

const sourceRegionLabel = (source: AiField['source']): string => {
  if (!source) return 'Not detected';
  if (source === 'both') return 'Front & back panel';
  if (source === 'front' || source === 'back') return `${imageLabelFor(source)} panel`;
  if (isAdditionalImageId(source)) return imageLabelFor(source);

  return 'Not detected';
};

/**
 * Appends real, known video-frame provenance to an already-computed
 * source region label — e.g. "Front panel" becomes
 * "Front panel (video frame, 4.2s)". Only appends when this specific
 * image id actually has a real timestamp on record (from Phase 4A's
 * extraction, passed in via BuildRealProductInput below); never invents
 * or guesses a timestamp, and leaves "both" sources untouched since a
 * "both" region isn't tied to one single image.
 */
const withVideoProvenance = (
  label: string,
  source: AiField['source'],
  videoTimestampByImageId: Partial<Record<ImageId, number>>
): string => {
  if (!source || source === 'both') return label;
  const timestamp = videoTimestampByImageId[source];
  if (typeof timestamp !== 'number') return label;
  return `${label} (video frame, ${timestamp.toFixed(1)}s)`;
};

/**
 * Deterministic PASS / REVIEW / FLAG decision. The AI only supplies
 * extracted values + confidence — it never decides compliance status.
 */
const statusFor = (
  hasValue: boolean,
  mandatory: boolean,
  confidence: number
): DeclarationStatus => {
  if (!hasValue) {
    return mandatory ? 'FLAG' : 'REVIEW';
  }

  if (confidence >= 0.8) return 'PASS';
  if (confidence >= 0.5) return 'REVIEW';

  return mandatory ? 'FLAG' : 'REVIEW';
};

const readabilityLabelFor = (confidence: number): Declaration['readabilityLabel'] => {
  if (confidence >= 0.8) return 'GOOD';
  if (confidence >= 0.5) return 'ACCEPTABLE';

  return 'LOW';
};

/**
 * Validate + clamp a raw AI evidence region into normalized (0-100) percent
 * coordinates on a specific image side. Returns null (never a fabricated
 * box) when the AI's evidence is missing, malformed, or points at neither
 * image side — the UI is responsible for showing "Evidence location
 * unavailable" in that case.
 */
const isKnownImageId = (image: unknown): image is ImageId =>
  image === 'front' || image === 'back' || (typeof image === 'string' && isAdditionalImageId(image));

const sanitizeEvidence = (raw: AiEvidence | null | undefined): EvidenceRegion | null => {
  if (!raw || !isKnownImageId(raw.image)) return null;

  const nums = [raw.x, raw.y, raw.width, raw.height];
  if (nums.some((n) => typeof n !== 'number' || Number.isNaN(n))) return null;

  const clamp = (n: number) => Math.min(100, Math.max(0, n));

  const width = clamp(raw.width);
  const height = clamp(raw.height);

  if (width <= 0 || height <= 0) return null;

  return {
    image: raw.image,
    x: clamp(raw.x),
    y: clamp(raw.y),
    width,
    height,
  };
};

export interface BuildRealProductInput {
  name: string;
  category: string;
  frontImageDataUrl: string;
  backImageDataUrl: string;
  /** Timestamp (seconds into the source video) the front/back image was
   * extracted from, if it came from the Phase 4A video scan pipeline
   * rather than a manual upload/camera capture. Null/undefined otherwise —
   * this is real data passed straight through from the upload flow, never
   * derived or guessed here. */
  frontVideoTimestampSeconds?: number | null;
  backVideoTimestampSeconds?: number | null;
  /** Optional additional views (side panels, top, bottom, close-ups),
   * in the order the user added them. */
  additionalImages?: {
    id: AdditionalImageId;
    dataUrl: string;
    timestampSeconds?: number | null;
  }[];
  analyzedAt: string;
  /** Raw JSON string returned by /api/analyze's `analysis` field. */
  aiAnalysisJson: string;
}

export const buildRealProductAnalysis = (
  input: BuildRealProductInput
): ProductAnalysis => {
  let extraction: AiExtraction = {};

  try {
    extraction = JSON.parse(input.aiAnalysisJson) as AiExtraction;
  } catch {
    extraction = {};
  }

  // Real, known video-frame provenance only — built straight from what
  // the upload flow actually recorded (see BuildRealProductInput above).
  // An image id simply has no entry here when it was a manual
  // upload/camera capture; never guessed or backfilled.
  const videoTimestampByImageId: Partial<Record<ImageId, number>> = {};
  if (typeof input.frontVideoTimestampSeconds === 'number') {
    videoTimestampByImageId.front = input.frontVideoTimestampSeconds;
  }
  if (typeof input.backVideoTimestampSeconds === 'number') {
    videoTimestampByImageId.back = input.backVideoTimestampSeconds;
  }
  (input.additionalImages || []).forEach((img) => {
    if (typeof img.timestampSeconds === 'number') {
      videoTimestampByImageId[img.id] = img.timestampSeconds;
    }
  });

  const declarations: Declaration[] = [];
  const findings: Finding[] = [];

  FIELD_SPECS.forEach((spec) => {
    const raw = extraction[spec.key];
    const value = (raw?.value ?? '').toString().trim();
    const hasValue = value.length > 0;
    const confidence = typeof raw?.confidence === 'number' ? raw.confidence : 0;
    const evidence = sanitizeEvidence(raw?.evidence ?? null);

    // Skip optional fields with no visible value — nothing to report.
    if (!hasValue && !spec.mandatory) return;

    const conflictNote = typeof raw?.conflict === 'string' ? raw.conflict.trim() : '';
    const hasConflict = conflictNote.length > 0;

    let status = statusFor(hasValue, spec.mandatory, confidence);
    // A conflicting read across images means the field is not actually
    // reliable even if one occurrence looked confident — the deterministic
    // layer (not the AI) downgrades a PASS to REVIEW so a human checks it.
    if (hasConflict && status === 'PASS') {
      status = 'REVIEW';
    }

    const confidencePct = Math.round(confidence * 100);
    const displayValue = hasValue ? value : 'Not confidently detected';
    const region = withVideoProvenance(
      sourceRegionLabel(raw?.source ?? null),
      raw?.source ?? null,
      videoTimestampByImageId
    );

    let explanation = !hasValue
      ? `${spec.field} was not detected with sufficient confidence in any of the submitted images. ${spec.mandatory ? 'This declaration is required.' : ''}`.trim()
      : `${spec.field} extracted as "${value}" from the ${region.toLowerCase()} at ${confidencePct}% confidence.`;

    if (hasConflict) {
      explanation += ` A conflict was flagged: ${conflictNote}. Manual verification required.`;
    }

    const recommendedAction = hasConflict
      ? `Manually verify ${spec.field.toLowerCase()} — a conflict was flagged: ${conflictNote}`
      : status === 'PASS'
        ? 'No action required.'
        : !hasValue
          ? `Manual verification required. Ensure ${spec.field.toLowerCase()} is clearly printed and legible.`
          : `Verify ${spec.field.toLowerCase()} is clearly legible; extraction confidence was below the review threshold.`;

    const declaration: Declaration = {
      id: `decl-${spec.key}`,
      field: spec.field,
      value: displayValue,
      extractedText: displayValue,
      confidence: confidencePct,
      // Legacy placeholder box kept only for type back-compat with demo
      // data consumers — real uploads must use `evidence` (real AI
      // coordinates) instead, never a fabricated grid box.
      boundingBox: { x: 0, y: 0, width: 0, height: 0 },
      evidence,
      sourceRegion: region,
      source: (raw?.source ?? null) as Declaration['source'],
      readabilityPx: Math.max(6, Math.round(confidence * 24)),
      readabilityLabel: readabilityLabelFor(confidence),
      status,
      ruleId: spec.ruleId,
      ruleCheck: spec.ruleCheck,
      explanation,
      recommendedAction,
    };

    declarations.push(declaration);

    if (status !== 'PASS') {
      findings.push({
        id: `finding-${spec.key}`,
        declarationId: declaration.id,
        title: !hasValue
          ? `${spec.field} not detected`
          : `${spec.field} needs review`,
        severity: status,
        ruleId: spec.ruleId,
        ruleCheck: spec.ruleCheck,
        reason: explanation,
        explanation,
        evidenceRegion: region,
        confidence: confidencePct,
        detectedText: displayValue,
        recommendation: recommendedAction,
      });
    }
  });

  const passCount = declarations.filter((d) => d.status === 'PASS').length;
  const reviewCount = declarations.filter((d) => d.status === 'REVIEW').length;
  const flagCount = declarations.filter((d) => d.status === 'FLAG').length;

  const mandatoryDeclCount = FIELD_SPECS.filter((s) => s.mandatory).length;
  const mandatoryPassCount = declarations.filter(
    (d) => d.status === 'PASS' && FIELD_SPECS.find((s) => s.field === d.field)?.mandatory
  ).length;

  const withValue = declarations.filter((d) => d.value !== 'Not confidently detected');
  const avgConfidence = withValue.length
    ? Math.round(
        withValue.reduce((sum, d) => sum + d.confidence, 0) / withValue.length
      )
    : 0;

  const scoreBreakdown: ComplianceScoreBreakdown = {
    mandatoryDeclarations: Math.round((mandatoryPassCount / mandatoryDeclCount) * 100),
    readability: avgConfidence,
    extractionConfidence: avgConfidence,
    placementVisibility: withValue.length
      ? Math.round(
          (withValue.filter((d) => d.sourceRegion !== 'Not detected').length /
            withValue.length) *
            100
        )
      : 0,
    labelConsistency: Math.round(
      ((passCount + reviewCount * 0.5) / Math.max(declarations.length, 1)) * 100
    ),
  };

  const qualityScore = Math.round(
    (scoreBreakdown.mandatoryDeclarations +
      scoreBreakdown.readability +
      scoreBreakdown.extractionConfidence +
      scoreBreakdown.placementVisibility +
      scoreBreakdown.labelConsistency) /
      5
  );

  const productName = extraction.product_name?.value?.toString().trim() || input.name;

  const id = `${REAL_UPLOAD_ID_PREFIX}${Date.now()}`;

  const additionalImages: AdditionalImage[] | undefined = input.additionalImages?.length
    ? input.additionalImages.map((img) => {
        const videoTimestampSeconds =
          typeof img.timestampSeconds === 'number' ? img.timestampSeconds : null;
        return {
          id: img.id,
          url: img.dataUrl,
          alt: `${productName} — ${imageLabelFor(img.id)} (${
            videoTimestampSeconds !== null
              ? `video frame, ${videoTimestampSeconds.toFixed(1)}s`
              : 'uploaded photo'
          })`,
          videoTimestampSeconds,
        };
      })
    : undefined;

  const frontVideoTimestampSeconds =
    typeof input.frontVideoTimestampSeconds === 'number' ? input.frontVideoTimestampSeconds : null;
  const backVideoTimestampSeconds =
    typeof input.backVideoTimestampSeconds === 'number' ? input.backVideoTimestampSeconds : null;

  return {
    id,
    name: productName,
    category: input.category,
    imageUrl: input.frontImageDataUrl,
    imageAlt: `${productName} — front of package (${
      frontVideoTimestampSeconds !== null
        ? `video frame, ${frontVideoTimestampSeconds.toFixed(1)}s`
        : 'uploaded photo'
    })`,
    backImageUrl: input.backImageDataUrl,
    backImageAlt: `${productName} — back of package (${
      backVideoTimestampSeconds !== null
        ? `video frame, ${backVideoTimestampSeconds.toFixed(1)}s`
        : 'uploaded photo'
    })`,
    frontVideoTimestampSeconds,
    backVideoTimestampSeconds,
    additionalImages,
    analyzedAt: input.analyzedAt,
    qualityScore,
    scoreBreakdown,
    declarations,
    findings,
    passCount,
    reviewCount,
    flagCount,
    rawAiExtraction: input.aiAnalysisJson,
  };
};

const isQuotaExceededError = (error: unknown): boolean => {
  if (!(error instanceof DOMException)) return false;
  // Name differs slightly across browsers (Firefox uses
  // NS_ERROR_DOM_QUOTA_REACHED historically); code 22 is the standard
  // QuotaExceededError DOMException code.
  return (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error.code === 22
  );
};

/**
 * Removes the single oldest real-upload product from storage (the last
 * entry in the most-recent-first index). Used only as a last resort when
 * a save hits the browser's storage quota — see saveRealProduct below.
 * Returns the evicted id, or null if there was nothing left to evict.
 */
const evictOldestRealProduct = (): string | null => {
  const ids = readIndex();
  const oldestId = ids[ids.length - 1];
  if (!oldestId) return null;

  try {
    window.localStorage.removeItem(`${STORAGE_KEY_PREFIX}${oldestId}`);
  } catch {
    // If removal itself fails there's nothing more we can safely try.
  }

  writeIndex(ids.slice(0, -1));
  return oldestId;
};

/**
 * Persists a real-upload product so it survives page navigation AND a
 * browser refresh. Uses localStorage (rather than sessionStorage) since
 * this is a client-only prototype with no backend database — localStorage
 * is the smallest reliable option that satisfies both requirements.
 *
 * On a QuotaExceededError this evicts the oldest saved real-upload
 * products (one at a time) and retries, up to a small bounded number of
 * attempts, before giving up. This trades old scan history for the
 * user's current scan actually saving — the alternative (failing
 * immediately) meant every scan after the first few would routinely fail
 * outright once history filled the quota, even though the browser's
 * total budget could easily hold the CURRENT product on its own once
 * older ones were dropped. Eviction is real deletion (not silent
 * corruption) and is limited to real-upload records — demo products are
 * never touched since they aren't stored here at all.
 *
 * Returns whether the save actually succeeded. This matters: if it
 * silently failed and the caller went on to navigate to the Compliance
 * Map using this product's id anyway, the page would resolve nothing and
 * show a bare "Product not found" — a confusing dead end after the user
 * already paid for / waited through analysis. Callers must check the
 * return value and tell the user honestly rather than assuming the save
 * worked.
 */
export const saveRealProduct = (product: ProductAnalysis): boolean => {
  if (!hasWindow()) return false;

  const MAX_EVICTION_ATTEMPTS = 5;
  const serialized = JSON.stringify(product);

  for (let attempt = 0; attempt <= MAX_EVICTION_ATTEMPTS; attempt++) {
    try {
      window.localStorage.setItem(`${STORAGE_KEY_PREFIX}${product.id}`, serialized);

      const existing = readIndex().filter((id) => id !== product.id);
      writeIndex([product.id, ...existing]);

      return true;
    } catch (error) {
      if (!isQuotaExceededError(error) || attempt === MAX_EVICTION_ATTEMPTS) {
        console.error(
          'Unable to persist real-upload product (storage quota exceeded even after evicting older scans):',
          error
        );
        return false;
      }

      const evictedId = evictOldestRealProduct();
      if (!evictedId) {
        // Nothing left to evict, yet the write still failed — the
        // current product alone exceeds what the browser can hold.
        console.error(
          'Unable to persist real-upload product: no older scans left to evict and storage is still full.'
        );
        return false;
      }

      console.warn(
        `Storage quota exceeded — evicted older real scan (${evictedId}) to make room and retrying.`
      );
    }
  }

  return false;
};

export const getRealProductById = (id: string): ProductAnalysis | null => {
  if (!isRealUploadId(id) || !hasWindow()) return null;

  migrateLegacyStorage();

  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${id}`);
    if (!raw) return null;

    return JSON.parse(raw) as ProductAnalysis;
  } catch {
    return null;
  }
};

/**
 * All real-upload products the user has scanned in this browser, most
 * recently saved first. Used by Compare (to offer real scans alongside
 * demo products) and History (to list real scans instead of only demo
 * data). Never throws — returns [] if storage is unavailable or empty.
 */
export const getAllRealProducts = (): ProductAnalysis[] => {
  if (!hasWindow()) return [];

  migrateLegacyStorage();

  const ids = readIndex();
  const products: ProductAnalysis[] = [];
  const survivingIds: string[] = [];

  for (const id of ids) {
    try {
      const raw = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${id}`);
      if (!raw) continue; // stale index entry — e.g. cleared manually

      products.push(JSON.parse(raw) as ProductAnalysis);
      survivingIds.push(id);
    } catch {
      // Skip a corrupted entry rather than failing the whole list.
    }
  }

  // Keep the index tidy if it drifted from what's actually in storage.
  if (survivingIds.length !== ids.length) {
    writeIndex(survivingIds);
  }

  return products;
};

/**
 * Single shared entry point for resolving a product id to its
 * ProductAnalysis record, regardless of whether it's a real upload
 * (localStorage) or a mockData.ts demo product. Every page that needs to
 * look up a product by id (Compliance Map, Ask LabelGuard/Copilot,
 * Compare, History, Report) should go through this instead of
 * re-implementing the `isRealUploadId(id) ? getRealProductById(id) :
 * getProductById(id)` branch itself.
 */
export const resolveProductById = (id: string | null | undefined): ProductAnalysis | undefined => {
  if (!id) return undefined;

  if (isRealUploadId(id)) {
    return getRealProductById(id) ?? undefined;
  }

  return getProductById(id);
};
