import { NextResponse } from "next/server";
import {
  generateWithRetryAndFallback,
  getGeminiErrorMessage,
  isRetryableGeminiError,
  parseImageDataUrl,
  stripJsonFences,
} from "@/lib/gemini";
import { buildDemoFallbackAnalysis } from "@/lib/demoFallback";

const ANALYSIS_UNAVAILABLE_MESSAGE =
  "Label analysis is temporarily unavailable. Please try again.";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const frontImageDataUrl = body?.frontImageDataUrl;
    const backImageDataUrl = body?.backImageDataUrl;
    const category = body?.category || "other";

    // Optional additional views (side panels, top, bottom, close-ups).
    // Each entry: { id: "additional-1".."additional-4", dataUrl: string }.
    // Invalid/malformed entries are silently dropped rather than failing
    // the whole request — additional views are always optional.
    const ADDITIONAL_ID_PATTERN = /^additional-[1-4]$/;
    const rawAdditionalImages = Array.isArray(body?.additionalImages)
      ? body.additionalImages
      : [];
    const additionalImages: { id: string; dataUrl: string }[] =
      rawAdditionalImages
        .filter(
          (img: unknown): img is { id: unknown; dataUrl: unknown } =>
            !!img && typeof img === "object"
        )
        .map((img: { id: unknown; dataUrl: unknown }) => ({
          id: typeof img.id === "string" ? img.id : "",
          dataUrl: typeof img.dataUrl === "string" ? img.dataUrl : "",
        }))
        .filter(
          (img: { id: string; dataUrl: string }) =>
            ADDITIONAL_ID_PATTERN.test(img.id) && img.dataUrl.length > 0
        )
        .slice(0, 4);

    if (
      !frontImageDataUrl ||
      typeof frontImageDataUrl !== "string" ||
      !backImageDataUrl ||
      typeof backImageDataUrl !== "string"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Both front and back product images are required.",
        },
        { status: 400 }
      );
    }

    // Every image sent to the model, in order, each with a stable id and a
    // friendly label the model can reference back in its "source"/"evidence
    // .image" output.
    const allImages: { id: string; label: string; dataUrl: string }[] = [
      { id: "front", label: "FRONT", dataUrl: frontImageDataUrl },
      { id: "back", label: "BACK", dataUrl: backImageDataUrl },
      ...additionalImages.map((img) => ({
        id: img.id,
        label: `VIEW ${img.id.split("-")[1]}`,
        dataUrl: img.dataUrl,
      })),
    ];

    const imageManifest = allImages
      .map(
        (img, i) =>
          `IMAGE ${i + 1}\nID: ${img.id}\nLABEL: ${img.label}`
      )
      .join("\n\n");

    const validImageIds = allImages.map((img) => `"${img.id}"`).join(" | ");

    // Opt-in emergency mode only: ?demo_fallback=true on the request URL.
    // Never read from the JSON body, so it can't be toggled by anything
    // in the payment/x402 flow — this is purely a query-string escape
    // hatch for when the real AI call is exhausted (see catch block).
    const demoFallbackRequested =
      new URL(request.url).searchParams.get("demo_fallback") === "true";

    const buildAnalyzeParams = () => ({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are LabelGuard AI, a packaged-product label inspection assistant.

The ${allImages.length} images below all show the SAME physical product package — different parts of the same package, such as the front, back, side panels, top, bottom, or close-ups of small text.

${imageManifest}

These images belong to the same product. Different images may show different parts of the package. Combine information across ALL images into one product record. Do not assume all declarations are on the front or back — required information (e.g. batch number, license number, MRP, warnings) may only appear on a side panel, top, bottom, or close-up image.

Product category: ${category}

Extract only information that is visibly present or reasonably readable.

Return ONLY valid JSON. Do not use markdown code fences.

Each field below must have this shape:

{
  "value": string | null,
  "source": ${validImageIds} | "both" | null,
  "confidence": number,
  "evidence": {
    "image": ${validImageIds},
    "x": number,
    "y": number,
    "width": number,
    "height": number
  } | null,
  "conflict": string | null
}

Use this structure (one entry per field, each shaped exactly as above):

{
  "product_name": { ... },
  "brand": { ... },
  "category": { ... },
  "net_quantity": { ... },
  "mrp": { ... },
  "batch_number": { ... },
  "manufacturing_date": { ... },
  "packaging_date": { ... },
  "expiry_date": { ... },
  "use_by_date": { ... },
  "ingredients": { ... },
  "manufacturer": { ... },
  "customer_care": { ... },
  "license_numbers": { ... },
  "warnings": { ... },
  "other_visible_declarations": { ... }
}

Rules:
1. Treat all ${allImages.length} images as one single product.
2. Do not assume that a declaration is missing just because it is absent from one image — check every image before deciding a field is missing.
3. Set "source" to the single image ID (see the list above, e.g. "front", "back", "additional-1") where the information is visible.
4. Use "both" only when the exact same information is clearly visible identically on two or more images (e.g. product name on both front and a close-up).
5. If a field is not visible or readable in any image, set "value", "source" and "evidence" to null and confidence to 0.
6. Never invent or guess information. If you are not sure, lower the confidence or return null — do not fill in a plausible-looking value.
7. Confidence must be between 0 and 1.
8. Preserve visible text as accurately as possible.
9. Avoid duplicate extraction — if the same information appears on more than one image, report it once and prefer the clearest, most legible occurrence for "source"/"evidence".

CRITICAL FIELDS — read character-by-character:
10. These fields require special care because a single misread character changes their meaning entirely: batch_number, manufacturing_date, packaging_date, expiry_date, use_by_date, mrp, net_quantity, license_numbers. For these fields specifically:
    - Read every character individually before transcribing the value — do not skim or pattern-match to what a "typical" value might look like.
    - Pay deliberate attention to visually similar characters that are commonly confused in printed/embossed label text, including but not limited to: B vs 8, 0 (zero) vs O (letter), 1 vs I vs l, 5 vs S, 6 vs G, F vs P. When a character is ambiguous, look at the overall font style used elsewhere on the same label for a consistency cue, but do not guess — lower confidence instead.
    - If the text is small, blurry, low-contrast, at an angle, or partially obscured, lower the confidence accordingly rather than reporting a confident-looking guess.
    - If a critical field is genuinely unreadable, set "value" to null and confidence to 0 rather than inventing a plausible value.
11. If the same critical field is visible on more than one image, cross-check the readings against each other before deciding on a final value:
    - If all occurrences agree, report the value once from the clearest occurrence and leave "conflict" null.
    - If occurrences genuinely disagree (not just difference in framing/crop, but a different actual value), do NOT silently pick one. Set "value" to the reading you are more confident in, and set "conflict" to a short plain-English note naming both readings and where each was seen (e.g. "back panel reads X, additional-1 reads Y"). Leave "conflict" null whenever there is no real disagreement.

Evidence coordinates (bounding box):
12. "evidence.image" must be the SAME single image ID the declaration's text is actually printed on — never "both", even if "source" is "both" (in that case pick the clearer of the two occurrences).
13. x, y, width, height are normalized PERCENTAGES (0-100) of that image's own width/height: x = left position, y = top position, width = box width, height = box height, all as a percentage of that single image's dimensions — not of a combined or side-by-side image.
14. Only set evidence when you can confidently locate roughly where the text sits in the image. If you are not confident of the location, set "evidence" to null even if "value" is known — do not invent or estimate a fake/placeholder/grid box.
15. Never output the same fixed/grid coordinates for multiple fields — each evidence box must reflect that field's actual position in the image.`,
            },
            ...allImages.map((img) => {
              const { mimeType, data } = parseImageDataUrl(img.dataUrl);
              return { inlineData: { mimeType, data } };
            }),
          ],
        },
      ],
      config: {
        // Ask Gemini for JSON directly (its native structured-output
        // mode) instead of relying purely on prompt instructions like
        // the old "Return ONLY valid JSON" line above. temperature: 0
        // favors consistent, literal transcription over creative
        // phrasing, which matters for label fields like batch numbers.
        responseMimeType: "application/json",
        temperature: 0,
      },
    });

    // Real AI attempt: primary model, then one short-backoff retry, then
    // (only if configured via env) one attempt against a fallback
    // model/backup key. See src/lib/gemini.ts for the exact bounded
    // sequence — there is no unbounded retry loop here.
    try {
      const { result: candidate, attempt, model, usedBackupKey } =
        await generateWithRetryAndFallback(buildAnalyzeParams, (response) => {
          const rawText = response.text;
          if (!rawText) {
            throw new Error("Model returned no text.");
          }

          // Defensive: validate the model actually returned parseable
          // JSON before handing it to the frontend, which does its own
          // `JSON.parse(data.analysis)`. Never fabricate/patch missing
          // compliance data if parsing fails — this throws so the outer
          // catch can return an honest error instead.
          const parsedCandidate = stripJsonFences(rawText);
          try {
            JSON.parse(parsedCandidate);
          } catch {
            console.error(
              "LabelGuard AI analysis error: model returned non-JSON output",
              rawText
            );
            throw new Error("Model returned non-JSON output.");
          }

          return parsedCandidate;
        });

      if (attempt !== "primary") {
        console.info(
          `LabelGuard AI: /api/analyze succeeded on "${attempt}" attempt (model=${model}, usedBackupKey=${usedBackupKey}).`
        );
      }

      return NextResponse.json({
        success: true,
        analysis: candidate,
      });
    } catch (aiError) {
      console.error("LabelGuard AI analysis error:", aiError);

      // Emergency mode ONLY: real AI was already attempted (primary +
      // retry + any configured fallback, all above) and every attempt
      // failed with a genuinely temporary error. Only then, and only
      // when the caller explicitly opted in via ?demo_fallback=true, do
      // we substitute an existing demo product's data — clearly flagged
      // as such, never presented as if it were this user's real result.
      if (demoFallbackRequested && isRetryableGeminiError(aiError)) {
        const demo = buildDemoFallbackAnalysis(category);

        console.warn(
          `LabelGuard AI: /api/analyze real AI exhausted retries; demo_fallback=true, returning demo data from "${demo.sourceProductId}".`
        );

        return NextResponse.json({
          success: true,
          analysis: demo.analysisJson,
          demoFallback: true,
          demoFallbackReason:
            "The AI service was temporarily unavailable, so this request explicitly fell back to demo data instead of your real label.",
          demoFallbackSource: demo.sourceProductId,
        });
      }

      return NextResponse.json(
        {
          success: false,
          error: getGeminiErrorMessage(aiError, ANALYSIS_UNAVAILABLE_MESSAGE),
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("LabelGuard AI analysis error:", error);

    return NextResponse.json(
      {
        success: false,
        error: getGeminiErrorMessage(error, ANALYSIS_UNAVAILABLE_MESSAGE),
      },
      { status: 500 }
    );
  }
}