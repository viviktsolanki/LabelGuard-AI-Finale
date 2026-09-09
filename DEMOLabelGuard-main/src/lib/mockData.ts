// ─── TYPES ───────────────────────────────────────────────────────────────────

export type DeclarationStatus = 'PASS' | 'REVIEW' | 'FLAG';

/** Which uploaded image (front or back) a piece of evidence belongs to. */
export type ImageSide = 'front' | 'back';

/**
 * Optional additional product views beyond front/back — side panels, top,
 * bottom, close-ups, etc. The user never classifies these; they are always
 * generic, numbered slots. Capped at MAX_ADDITIONAL_IMAGES.
 */
export type AdditionalImageId = 'additional-1' | 'additional-2' | 'additional-3' | 'additional-4';

export const ADDITIONAL_IMAGE_IDS: AdditionalImageId[] = [
  'additional-1',
  'additional-2',
  'additional-3',
  'additional-4',
];

export const MAX_ADDITIONAL_IMAGES = ADDITIONAL_IMAGE_IDS.length;

/**
 * Any image a piece of evidence can belong to: the required front/back
 * pair, or one of the optional additional views. Kept as a superset of
 * `ImageSide` so existing front/back-only code paths remain valid.
 */
export type ImageId = ImageSide | AdditionalImageId;

export const isAdditionalImageId = (id: string): id is AdditionalImageId =>
  (ADDITIONAL_IMAGE_IDS as string[]).includes(id);

/** User-facing label for an image id. Internal ids (e.g. `additional-1`)
 * are never shown to the user — always display via this helper. */
export const imageLabelFor = (id: ImageId | string): string => {
  if (id === 'front') return 'Front';
  if (id === 'back') return 'Back';

  const match = /^additional-([1-4])$/.exec(id);
  if (match) return `View ${match[1]}`;

  return id;
};

/** A single optional additional product view (side panel, top, bottom,
 * close-up, etc). Stored alongside the required front/back images. */
export interface AdditionalImage {
  id: AdditionalImageId;
  url: string;
  alt: string;
  /** Timestamp (seconds into the source video) this view was extracted
   * from, if it came from Phase 4A's smart video frame selection instead
   * of a manual photo/camera capture. Null/undefined for a manually
   * provided image — never invented when the real provenance is unknown. */
  videoTimestampSeconds?: number | null;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A real, AI-located evidence region on ONE specific image (front, back, or
 * an optional additional view). `null` when the AI could not confidently
 * locate the declaration — the UI must show "Evidence location unavailable"
 * rather than a fake box.
 */
export interface EvidenceRegion extends BoundingBox {
  image: ImageId;
}

export interface Declaration {
  id: string;
  field: string;
  /** The extracted/detected text value */
  value: string;
  /** Alias for value — used in evidence display */
  extractedText: string;
  confidence: number;
  /**
   * @deprecated legacy demo-only placeholder box, kept for the existing
   * mockData.ts demo products. Real uploads should use `evidence` instead.
   */
  boundingBox: BoundingBox;
  /** Real AI-detected evidence location, or null if not confidently located. */
  evidence?: EvidenceRegion | null;
  sourceRegion: string;
  /** Which image(s) this declaration's value was found on. */
  source?: ImageId | 'both' | null;
  readabilityPx: number;
  readabilityLabel: 'GOOD' | 'ACCEPTABLE' | 'LOW';
  status: DeclarationStatus;
  ruleId: string;
  /** Short rule check identifier shown in evidence panel */
  ruleCheck: string;
  /** Why this was marked PASS / REVIEW / FLAG */
  explanation: string;
  /** What the user should do */
  recommendedAction: string;
}

export interface Finding {
  id: string;
  declarationId: string;
  title: string;
  severity: DeclarationStatus;
  ruleId: string;
  /** Short rule check identifier */
  ruleCheck: string;
  reason: string;
  /** Why it was marked this status */
  explanation: string;
  evidenceRegion: string;
  confidence: number;
  detectedText: string;
  recommendation: string;
}

export interface ComplianceScoreBreakdown {
  mandatoryDeclarations: number;
  readability: number;
  extractionConfidence: number;
  placementVisibility: number;
  labelConsistency: number;
}

/** @deprecated use ComplianceScoreBreakdown */
export type QualityScoreBreakdown = ComplianceScoreBreakdown;

export interface ProductAnalysis {
  id: string;
  name: string;
  category: string;
  /** Front-of-package image. For demo products this is the only image. */
  imageUrl: string;
  imageAlt: string;
  /** Back-of-package image — only present for real uploads (front+back). */
  backImageUrl?: string;
  backImageAlt?: string;
  /** Timestamp (seconds into the source video) the front/back image was
   * extracted from, if it came from Phase 4A's smart video frame
   * selection instead of a manual photo/camera capture. Null/undefined
   * for a manually provided image. */
  frontVideoTimestampSeconds?: number | null;
  backVideoTimestampSeconds?: number | null;
  /** Optional additional views (side panels, top, bottom, close-ups) —
   * only present for real uploads where the user added extra views. */
  additionalImages?: AdditionalImage[];
  analyzedAt: string;
  /** Compliance Screening Score 0–100 */
  qualityScore: number;
  scoreBreakdown: ComplianceScoreBreakdown;
  declarations: Declaration[];
  findings: Finding[];
  passCount: number;
  reviewCount: number;
  flagCount: number;
  /** Raw AI extraction JSON string — only present for real uploads. Shown behind a "Technical details" toggle. */
  rawAiExtraction?: string;
}

// ─── PRODUCT A — COMPLIANT: Sunrise Basmati Rice ─────────────────────────────
export const PRODUCT_A: ProductAnalysis = {
  id: 'product-a-001',
  name: 'Sunrise Basmati Rice 1kg',
  category: 'Food',
  imageUrl: '/assets/images/sunrise_basmati_rice.png',
  imageAlt: 'Sunrise Basmati Rice 1kg packaged product with clearly printed label declarations',
  analyzedAt: '29 Aug 2026, 14:42',
  qualityScore: 94,
  scoreBreakdown: {
    mandatoryDeclarations: 98,
    readability: 96,
    extractionConfidence: 97,
    placementVisibility: 91,
    labelConsistency: 93,
  },
  declarations: [
    {
      id: 'decl-a-001',
      field: 'Product Name',
      value: 'Sunrise Premium Basmati Rice',
      extractedText: 'Sunrise Premium Basmati Rice',
      confidence: 99,
      boundingBox: { x: 33, y: 25, width: 34, height: 21 },
      sourceRegion: 'Front panel — top',
      readabilityPx: 24,
      readabilityLabel: 'GOOD',
      status: 'PASS',
      ruleId: 'product_name_required',
      ruleCheck: 'RULE-001: Product name declaration',
      explanation: 'Product name is clearly printed in large, high-contrast text at the top of the front panel. Extraction confidence is 99%. Passes mandatory declaration check.',
      recommendedAction: 'No action required.',
    },
    {
      id: 'decl-a-002',
      field: 'Net Quantity',
      value: '1 kg',
      extractedText: '1 kg',
      confidence: 98,
      boundingBox: { x: 59, y: 72, width: 13, height: 7 },
      sourceRegion: 'Front panel — bottom right',
      readabilityPx: 20,
      readabilityLabel: 'GOOD',
      status: 'PASS',
      ruleId: 'net_quantity_required',
      ruleCheck: 'RULE-002: Net quantity declaration',
      explanation: 'Net quantity "1 kg" is clearly printed on the front panel. Confidence 98%. Complies with mandatory net quantity declaration requirement.',
      recommendedAction: 'No action required.',
    },
    {
      id: 'decl-a-003',
      field: 'MRP',
      value: '₹89.00 (Incl. all taxes)',
      extractedText: '₹89.00 (Incl. all taxes)',
      confidence: 97,
      boundingBox: { x: 56, y: 59, width: 18, height: 7 },
      sourceRegion: 'Back panel — bottom left',
      readabilityPx: 18,
      readabilityLabel: 'GOOD',
      status: 'PASS',
      ruleId: 'mrp_required',
      ruleCheck: 'RULE-003: MRP declaration',
      explanation: 'MRP is clearly declared as ₹89.00 including all taxes. Confidence 97%. Font size is adequate. Passes MRP declaration check.',
      recommendedAction: 'No action required.',
    },
    {
      id: 'decl-a-004',
      field: 'Manufacturer Name',
      value: 'Sunrise Agro Foods Pvt. Ltd.',
      extractedText: 'Sunrise Agro Foods Pvt. Ltd.',
      confidence: 96,
      boundingBox: { x: 54, y: 61, width: 21, height: 5 },
      sourceRegion: 'Back panel — middle',
      readabilityPx: 14,
      readabilityLabel: 'GOOD',
      status: 'PASS',
      ruleId: 'manufacturer_required',
      ruleCheck: 'RULE-004: Manufacturer name declaration',
      explanation: 'Manufacturer name fully extracted with 96% confidence. Clearly printed on back panel. Passes mandatory manufacturer declaration.',
      recommendedAction: 'No action required.',
    },
    {
      id: 'decl-a-005',
      field: 'Manufacturer Address',
      value: '14, Food Park, Karnal, Haryana — 132001',
      extractedText: '14, Food Park, Karnal, Haryana — 132001',
      confidence: 94,
      boundingBox: { x: 54, y: 63, width: 22, height: 5 },
      sourceRegion: 'Back panel — middle lower',
      readabilityPx: 13,
      readabilityLabel: 'GOOD',
      status: 'PASS',
      ruleId: 'manufacturer_required',
      ruleCheck: 'RULE-004: Manufacturer address declaration',
      explanation: 'Complete manufacturer address including PIN code 132001 extracted at 94% confidence. Passes address declaration check.',
      recommendedAction: 'No action required.',
    },
    {
      id: 'decl-a-006',
      field: 'Best Before / Expiry',
      value: 'Best Before: 18 Months from Packaging',
      extractedText: 'Best Before: 18 Months from Packaging',
      confidence: 95,
      boundingBox: { x: 68, y: 64, width: 7, height: 5 },
      sourceRegion: 'Back panel — bottom right',
      readabilityPx: 14,
      readabilityLabel: 'GOOD',
      status: 'PASS',
      ruleId: 'date_required',
      ruleCheck: 'RULE-005: Best before / expiry declaration',
      explanation: 'Best before date clearly stated as 18 months from packaging. Confidence 95%. Passes date declaration check.',
      recommendedAction: 'No action required.',
    },
    {
      id: 'decl-a-007',
      field: 'Consumer Care',
      value: '1800-XXX-XXXX | care@sunrisefoods.in',
      extractedText: '1800-XXX-XXXX | care@sunrisefoods.in',
      confidence: 92,
      boundingBox: { x: 54, y: 68, width: 22, height: 5 },
      sourceRegion: 'Back panel — bottom strip',
      readabilityPx: 13,
      readabilityLabel: 'GOOD',
      status: 'PASS',
      ruleId: 'consumer_care_required',
      ruleCheck: 'RULE-006: Consumer care declaration',
      explanation: 'Consumer care contact including toll-free number and email extracted at 92% confidence. Passes consumer care declaration check.',
      recommendedAction: 'No action required.',
    },
    {
      id: 'decl-a-008',
      field: 'FSSAI Licence No.',
      value: 'FSSAI Lic. No. 10016011008833',
      extractedText: 'FSSAI Lic. No. 10016011008833',
      confidence: 91,
      boundingBox: { x: 68, y: 70, width: 8, height: 4 },
      sourceRegion: 'Back panel — footer',
      readabilityPx: 12,
      readabilityLabel: 'ACCEPTABLE',
      status: 'PASS',
      ruleId: 'fssai_required',
      ruleCheck: 'RULE-007: FSSAI licence declaration',
      explanation: 'FSSAI licence number extracted at 91% confidence. Present in footer as required. Passes FSSAI declaration check.',
      recommendedAction: 'No action required.',
    },
  ],
  findings: [],
  passCount: 8,
  reviewCount: 0,
  flagCount: 0,
};

// ─── PRODUCT B — NON-COMPLIANT: NutriMax Oats ────────────────────────────────
export const PRODUCT_B: ProductAnalysis = {
  id: 'product-b-001',
  name: 'NutriMax Oats 500g',
  category: 'Food',
  imageUrl: '/assets/images/nutrimax_oats_label.jpg',
  imageAlt: 'NutriMax Oats 500g packaged product label showing front and back panel with compliance issues',
  analyzedAt: '29 Aug 2026, 17:15',
  qualityScore: 67,
  scoreBreakdown: {
    mandatoryDeclarations: 62,
    readability: 71,
    extractionConfidence: 78,
    placementVisibility: 55,
    labelConsistency: 69,
  },
  declarations: [
    {
      id: 'decl-b-001',
      field: 'Product Name',
      value: 'NutriMax Rolled Oats',
      extractedText: 'NutriMax Rolled Oats',
      confidence: 97,
      boundingBox: { x: 32, y: 23, width: 36, height: 13 },
      sourceRegion: 'Front panel — top center',
      readabilityPx: 22,
      readabilityLabel: 'GOOD',
      status: 'PASS',
      ruleId: 'product_name_required',
      ruleCheck: 'RULE-001: Product name declaration',
      explanation: 'Product name "NutriMax Rolled Oats" clearly printed at top of front panel. Confidence 97%. Passes product name declaration check.',
      recommendedAction: 'No action required.',
    },
    {
      id: 'decl-b-002',
      field: 'Net Quantity',
      value: '500 g',
      extractedText: '500 g',
      confidence: 94,
      boundingBox: { x: 64, y: 69, width: 9, height: 7 },
      sourceRegion: 'Front panel — bottom right',
      readabilityPx: 16,
      readabilityLabel: 'GOOD',
      status: 'PASS',
      ruleId: 'net_quantity_required',
      ruleCheck: 'RULE-002: Net quantity declaration',
      explanation: 'Net quantity "500 g" detected on front panel at 94% confidence. Passes net quantity declaration check.',
      recommendedAction: 'No action required.',
    },
    {
      id: 'decl-b-003',
      field: 'MRP',
      value: '₹180.00',
      extractedText: '₹180.00',
      confidence: 71,
      boundingBox: { x: 28, y: 76, width: 13, height: 5 },
      sourceRegion: 'Back panel — bottom left',
      readabilityPx: 14,
      readabilityLabel: 'ACCEPTABLE',
      status: 'REVIEW',
      ruleId: 'mrp_required',
      ruleCheck: 'RULE-003: MRP declaration',
      explanation: 'MRP "₹180.00" was detected but OCR confidence is 71% — below the 80% required threshold. The value may be partially obscured or printed in low-contrast ink on the back panel.',
      recommendedAction: 'Verify MRP is legibly printed with sufficient contrast. Confirm value ₹180.00 against source package label.',
    },
    {
      id: 'decl-b-004',
      field: 'Manufacturer Name',
      value: 'Not confidently detected',
      extractedText: 'Not confidently detected',
      confidence: 38,
      boundingBox: { x: 27, y: 70, width: 19, height: 6 },
      sourceRegion: 'Back panel — middle',
      readabilityPx: 7,
      readabilityLabel: 'LOW',
      status: 'FLAG',
      ruleId: 'manufacturer_required',
      ruleCheck: 'RULE-004: Manufacturer name declaration',
      explanation: 'Extraction confidence is 38% — significantly below threshold. The manufacturer name is a mandatory declaration. No sufficiently confident text match was found in the expected region. Estimated font size is 7px — below minimum readability threshold.',
      recommendedAction: 'Manual verification required. Inspect back panel middle section. Ensure manufacturer name is printed legibly with minimum 1mm font height.',
    },
    {
      id: 'decl-b-005',
      field: 'Manufacturer Address',
      value: '...Industrial Area, Pune',
      extractedText: '...Industrial Area, Pune',
      confidence: 52,
      boundingBox: { x: 27, y: 73, width: 21, height: 6 },
      sourceRegion: 'Back panel — middle lower',
      readabilityPx: 8,
      readabilityLabel: 'LOW',
      status: 'FLAG',
      ruleId: 'manufacturer_required',
      ruleCheck: 'RULE-004: Manufacturer address declaration',
      explanation: 'Only a partial address was extracted: "...Industrial Area, Pune". The beginning of the address is missing or illegible. Confidence 52%. A complete manufacturer address including PIN code is required.',
      recommendedAction: 'Verify the complete manufacturer address is present including street, city, state, and PIN code.',
    },
    {
      id: 'decl-b-006',
      field: 'Best Before / Expiry',
      value: 'BB: 03/2027',
      extractedText: 'BB: 03/2027',
      confidence: 83,
      boundingBox: { x: 64, y: 76, width: 10, height: 5 },
      sourceRegion: 'Back panel — bottom right',
      readabilityPx: 12,
      readabilityLabel: 'ACCEPTABLE',
      status: 'REVIEW',
      ruleId: 'date_required',
      ruleCheck: 'RULE-005: Best before / expiry declaration',
      explanation: 'Date "BB: 03/2027" detected at 83% confidence but estimated font size is 12px — borderline acceptable. Physical inspection should confirm the date is legible under normal viewing conditions.',
      recommendedAction: 'Verify date is clearly readable. Consider increasing font size to minimum 14px equivalent.',
    },
    {
      id: 'decl-b-007',
      field: 'Consumer Care',
      value: 'Not confidently detected',
      extractedText: 'Not confidently detected',
      confidence: 29,
      boundingBox: { x: 37, y: 80, width: 24, height: 5 },
      sourceRegion: 'Back panel — bottom strip',
      readabilityPx: 6,
      readabilityLabel: 'LOW',
      status: 'FLAG',
      ruleId: 'consumer_care_required',
      ruleCheck: 'RULE-006: Consumer care declaration',
      explanation: 'No consumer care contact was detected with sufficient confidence (29%). Consumer care details are a mandatory declaration. The region shows extremely low readability at estimated 6px — far below minimum threshold.',
      recommendedAction: 'Manual verification required. Add or verify consumer care contact details. Minimum recommended font size is 14px equivalent.',
    },
    {
      id: 'decl-b-008',
      field: 'FSSAI Licence No.',
      value: '10016011002789',
      extractedText: '10016011002789',
      confidence: 88,
      boundingBox: { x: 61, y: 79, width: 14, height: 5 },
      sourceRegion: 'Back panel — footer',
      readabilityPx: 11,
      readabilityLabel: 'ACCEPTABLE',
      status: 'PASS',
      ruleId: 'fssai_required',
      ruleCheck: 'RULE-007: FSSAI licence declaration',
      explanation: 'FSSAI licence number "10016011002789" extracted at 88% confidence. Present in footer. Passes FSSAI declaration check.',
      recommendedAction: 'No action required.',
    },
  ],
  findings: [
    {
      id: 'finding-b-001',
      declarationId: 'decl-b-003',
      title: 'MRP text confidence below threshold',
      severity: 'REVIEW',
      ruleId: 'mrp_required',
      ruleCheck: 'RULE-003: MRP declaration',
      reason: 'MRP was detected but OCR confidence is 71% — below the 80% required threshold.',
      explanation: 'The value ₹180.00 was extracted from the back panel bottom-left region, but the low-contrast printing reduces extraction confidence below the acceptable threshold. The declaration requires additional verification.',
      evidenceRegion: 'Back panel — bottom left',
      confidence: 71,
      detectedText: '₹180.00',
      recommendation: 'Manual verification recommended. Confirm MRP is legibly printed with sufficient contrast against the background.',
    },
    {
      id: 'finding-b-002',
      declarationId: 'decl-b-004',
      title: 'Manufacturer name not confidently detected',
      severity: 'FLAG',
      ruleId: 'manufacturer_required',
      ruleCheck: 'RULE-004: Manufacturer name declaration',
      reason: 'Extraction confidence is 38% — significantly below threshold. No sufficiently confident text match was found.',
      explanation: 'The manufacturer name is a mandatory declaration. The back panel middle region shows text at an estimated 7px font size — far below the minimum readability threshold. The AI could not extract a confident manufacturer name from this region.',
      evidenceRegion: 'Back panel — middle',
      confidence: 38,
      detectedText: 'Not confidently detected',
      recommendation: 'Manual verification required. Inspect the back panel middle section. Ensure manufacturer name is printed legibly with minimum 1mm font height.',
    },
    {
      id: 'finding-b-003',
      declarationId: 'decl-b-005',
      title: 'Manufacturer address appears truncated',
      severity: 'FLAG',
      ruleId: 'manufacturer_required',
      ruleCheck: 'RULE-004: Manufacturer address declaration',
      reason: 'Only a partial address was extracted: "...Industrial Area, Pune". The beginning of the address is missing or illegible.',
      explanation: 'The extracted text "...Industrial Area, Pune" indicates the address is either cut off or the beginning is unreadable. A complete manufacturer address including street number, city, state, and PIN code is required. Confidence is 52%.',
      evidenceRegion: 'Back panel — middle lower',
      confidence: 52,
      detectedText: '...Industrial Area, Pune',
      recommendation: 'Verify the complete manufacturer address is present including street, city, state, and PIN code.',
    },
    {
      id: 'finding-b-004',
      declarationId: 'decl-b-006',
      title: 'Best Before date readability is borderline',
      severity: 'REVIEW',
      ruleId: 'date_required',
      ruleCheck: 'RULE-005: Best before / expiry declaration',
      reason: 'Date detected at 83% confidence but estimated font size is 12px — borderline acceptable.',
      explanation: 'The date "BB: 03/2027" was extracted from the back panel bottom-right region. While the confidence is above threshold, the estimated font size of 12px is borderline. Physical inspection should confirm legibility under normal viewing conditions.',
      evidenceRegion: 'Back panel — bottom right',
      confidence: 83,
      detectedText: 'BB: 03/2027',
      recommendation: 'Verify date is clearly readable. Consider increasing font size to minimum 14px equivalent for improved compliance.',
    },
    {
      id: 'finding-b-005',
      declarationId: 'decl-b-007',
      title: 'Consumer care information missing or unreadable',
      severity: 'FLAG',
      ruleId: 'consumer_care_required',
      ruleCheck: 'RULE-006: Consumer care declaration',
      reason: 'No consumer care contact was detected with sufficient confidence (29%). The region shows extremely low readability at estimated 6px.',
      explanation: 'Consumer care details are a mandatory declaration. The bottom strip region of the back panel shows text at an estimated 6px — far below the minimum readability threshold. The AI could not extract any consumer care contact information with sufficient confidence.',
      evidenceRegion: 'Back panel — bottom strip',
      confidence: 29,
      detectedText: 'Not confidently detected',
      recommendation: 'Manual verification required. Add or verify consumer care contact details. Minimum recommended font size is 14px equivalent for this declaration.',
    },
  ],
  passCount: 3,
  reviewCount: 2,
  flagCount: 3,
};

// ─── PRODUCT C — REVIEW REQUIRED: CleanHome Dishwash Gel ─────────────────────
export const PRODUCT_C: ProductAnalysis = {
  id: 'product-c-001',
  name: 'CleanHome Dishwash Gel 500ml',
  category: 'Household',
  imageUrl: '/assets/images/cleanhome_dishwash_label.png',
  imageAlt: 'CleanHome Dishwash Gel 500ml product bottle with label showing cleaning product declarations',
  analyzedAt: '29 Aug 2026, 11:08',
  qualityScore: 74,
  scoreBreakdown: {
    mandatoryDeclarations: 78,
    readability: 68,
    extractionConfidence: 72,
    placementVisibility: 76,
    labelConsistency: 71,
  },
  declarations: [
    {
      id: 'decl-c-001',
      field: 'Product Name',
      value: 'CleanHome Lemon Fresh Dishwash',
      extractedText: 'CleanHome Lemon Fresh Dishwash',
      confidence: 91,
      boundingBox: { x: 38, y: 38, width: 24, height: 14 },
      sourceRegion: 'Front panel — top',
      readabilityPx: 20,
      readabilityLabel: 'GOOD',
      status: 'PASS',
      ruleId: 'product_name_required',
      ruleCheck: 'RULE-001: Product name declaration',
      explanation: 'Product name "CleanHome Lemon Fresh Dishwash" clearly printed at top of front panel. Confidence 91%. Passes product name declaration check.',
      recommendedAction: 'No action required.',
    },
    {
      id: 'decl-c-002',
      field: 'Net Quantity',
      value: '500 ml',
      extractedText: '500 ml',
      confidence: 88,
      boundingBox: { x: 54, y: 72, width: 8, height: 6 },
      sourceRegion: 'Front panel — bottom right',
      readabilityPx: 16,
      readabilityLabel: 'GOOD',
      status: 'PASS',
      ruleId: 'net_quantity_required',
      ruleCheck: 'RULE-002: Net quantity declaration',
      explanation: 'Net quantity "500 ml" detected on front panel at 88% confidence. Passes net quantity declaration check.',
      recommendedAction: 'No action required.',
    },
    {
      id: 'decl-c-003',
      field: 'MRP',
      value: '₹85.00',
      extractedText: '₹85.00',
      confidence: 76,
      boundingBox: { x: 37, y: 77, width: 16, height: 5 },
      sourceRegion: 'Back panel — bottom left',
      readabilityPx: 13,
      readabilityLabel: 'ACCEPTABLE',
      status: 'REVIEW',
      ruleId: 'mrp_required',
      ruleCheck: 'RULE-003: MRP declaration',
      explanation: 'MRP "₹85.00" detected at 76% confidence with estimated 13px font size. While the value was extracted, the readability is borderline acceptable and confidence is below the 80% threshold.',
      recommendedAction: 'Verify MRP is clearly legible. Recommend increasing font size and ensuring high contrast printing.',
    },
    {
      id: 'decl-c-004',
      field: 'Manufacturer Name',
      value: 'Hygiene Solutions Ltd.',
      extractedText: 'Hygiene Solutions Ltd.',
      confidence: 82,
      boundingBox: { x: 37, y: 77, width: 24, height: 5 },
      sourceRegion: 'Back panel — middle',
      readabilityPx: 11,
      readabilityLabel: 'ACCEPTABLE',
      status: 'PASS',
      ruleId: 'manufacturer_required',
      ruleCheck: 'RULE-004: Manufacturer name declaration',
      explanation: 'Manufacturer name "Hygiene Solutions Ltd." extracted at 82% confidence. Passes manufacturer name declaration check, though readability could be improved.',
      recommendedAction: 'No action required. Consider improving font size for better readability.',
    },
    {
      id: 'decl-c-005',
      field: 'Manufacturer Address',
      value: 'Sector 12, Faridabad',
      extractedText: 'Sector 12, Faridabad',
      confidence: 61,
      boundingBox: { x: 37, y: 79, width: 24, height: 5 },
      sourceRegion: 'Back panel — middle lower',
      readabilityPx: 8,
      readabilityLabel: 'LOW',
      status: 'REVIEW',
      ruleId: 'manufacturer_required',
      ruleCheck: 'RULE-004: Manufacturer address declaration',
      explanation: 'Address extraction confidence is 61%. Only partial address "Sector 12, Faridabad" detected — state and PIN code appear to be cut off or illegible. Complete address with PIN code is required.',
      recommendedAction: 'Verify complete address including state and PIN code is present and legible.',
    },
    {
      id: 'decl-c-006',
      field: 'Best Before / Expiry',
      value: 'MFG: 06/2026',
      extractedText: 'MFG: 06/2026',
      confidence: 79,
      boundingBox: { x: 54, y: 77, width: 9, height: 5 },
      sourceRegion: 'Back panel — bottom right',
      readabilityPx: 12,
      readabilityLabel: 'ACCEPTABLE',
      status: 'REVIEW',
      ruleId: 'date_required',
      ruleCheck: 'RULE-005: Best before / expiry declaration',
      explanation: 'Manufacturing date "MFG: 06/2026" detected at 79% confidence. However, the best before or expiry date is not separately declared. Only the manufacturing date was found. Confidence is just below the 80% threshold.',
      recommendedAction: 'Verify that a best before or expiry date is clearly declared in addition to the manufacturing date.',
    },
    {
      id: 'decl-c-007',
      field: 'Consumer Care',
      value: '1800-XXX-0099',
      extractedText: '1800-XXX-0099',
      confidence: 84,
      boundingBox: { x: 37, y: 80, width: 24, height: 5 },
      sourceRegion: 'Back panel — bottom strip',
      readabilityPx: 10,
      readabilityLabel: 'ACCEPTABLE',
      status: 'PASS',
      ruleId: 'consumer_care_required',
      ruleCheck: 'RULE-006: Consumer care declaration',
      explanation: 'Consumer care number "1800-XXX-0099" extracted at 84% confidence. Passes consumer care declaration check, though font size is borderline at 10px.',
      recommendedAction: 'No action required. Consider increasing font size for better readability.',
    },
    {
      id: 'decl-c-008',
      field: 'Batch / Lot Number',
      value: 'Not confidently detected',
      extractedText: 'Not confidently detected',
      confidence: 44,
      boundingBox: { x: 37, y: 82, width: 25, height: 5 },
      sourceRegion: 'Back panel — footer',
      readabilityPx: 6,
      readabilityLabel: 'LOW',
      status: 'FLAG',
      ruleId: 'batch_required',
      ruleCheck: 'RULE-008: Batch / lot number declaration',
      explanation: 'No batch or lot number was detected with sufficient confidence (44%). The footer region shows text at an estimated 6px — far below minimum readability. Batch/lot number is required for product traceability.',
      recommendedAction: 'Manual verification required. Ensure batch/lot number is clearly printed in the footer region.',
    },
  ],
  findings: [
    {
      id: 'finding-c-001',
      declarationId: 'decl-c-003',
      title: 'MRP readability borderline',
      severity: 'REVIEW',
      ruleId: 'mrp_required',
      ruleCheck: 'RULE-003: MRP declaration',
      reason: 'MRP detected at 76% confidence with estimated 13px font size.',
      explanation: 'The value ₹85.00 was extracted from the back panel bottom-left region. While the value was detected, the confidence of 76% is below the 80% threshold and the font size of 13px is borderline acceptable. The declaration requires additional verification.',
      evidenceRegion: 'Back panel — bottom left',
      confidence: 76,
      detectedText: '₹85.00',
      recommendation: 'Verify MRP is clearly legible. Recommend increasing font size and ensuring high contrast printing.',
    },
    {
      id: 'finding-c-002',
      declarationId: 'decl-c-005',
      title: 'Manufacturer address appears incomplete',
      severity: 'REVIEW',
      ruleId: 'manufacturer_required',
      ruleCheck: 'RULE-004: Manufacturer address declaration',
      reason: 'Address extraction confidence is 61%. Only partial address detected.',
      explanation: 'The extracted text "Sector 12, Faridabad" indicates the address is incomplete. The state and PIN code are not visible or are illegible. A complete manufacturer address is required. The low readability at 8px contributes to the low confidence.',
      evidenceRegion: 'Back panel — middle lower',
      confidence: 61,
      detectedText: 'Sector 12, Faridabad',
      recommendation: 'Verify complete address including state and PIN code is present and legible.',
    },
    {
      id: 'finding-c-003',
      declarationId: 'decl-c-008',
      title: 'Batch/Lot number not detected',
      severity: 'FLAG',
      ruleId: 'batch_required',
      ruleCheck: 'RULE-008: Batch / lot number declaration',
      reason: 'No batch or lot number was detected with sufficient confidence (44%).',
      explanation: 'The footer region of the back panel shows a blank or illegible area where the batch/lot number should appear. The estimated font size of 6px is far below the minimum readability threshold. Batch/lot number is required for product traceability and recall management.',
      evidenceRegion: 'Back panel — footer',
      confidence: 44,
      detectedText: 'Not confidently detected',
      recommendation: 'Manual verification required. Ensure batch/lot number is clearly printed with adequate font size.',
    },
  ],
  passCount: 4,
  reviewCount: 3,
  flagCount: 1,
};

export const DEMO_PRODUCTS = [PRODUCT_A, PRODUCT_B, PRODUCT_C];

export const getProductById = (id: string): ProductAnalysis | undefined => {
  return DEMO_PRODUCTS.find((p) => p.id === id);
};
