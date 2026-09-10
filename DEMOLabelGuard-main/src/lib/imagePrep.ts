/**
 * Client-side image preparation for uploads.
 *
 * ROOT CAUSE THIS FIXES: raw phone-camera photos (often 3000-4000px+,
 * 3-10MB each as JPEG) were being read directly into base64 data URLs via
 * FileReader and stuffed into sessionStorage (`labelguard:pending-upload`)
 * and later localStorage (`saveRealProduct`). A single scan needs a front +
 * back image (and can have up to 4 more), so realistic photos routinely
 * exceeded the ~5-10MB per-origin quota most browsers enforce on
 * sessionStorage/localStorage. The sessionStorage write is wrapped in a
 * try/catch that DOES surface an error toast, but real-world users would
 * hit "Could not prepare the images for analysis" on essentially every
 * scan taken with a modern phone camera — the core upload flow was broken
 * for its actual intended input, not just an edge case.
 *
 * FIX: downscale to a resolution that is still far more than sufficient
 * for OCR of small printed label text (long edge capped at
 * MAX_DIMENSION_PX) and re-encode as JPEG at a quality that keeps text
 * legible while cutting file size dramatically (a 4000x3000 12MP phone
 * photo becomes roughly a few hundred KB instead of several MB). This
 * same, single data URL is what gets sent to the /api/analyze vision
 * model AND what gets persisted, so there is no separate "quality for AI"
 * vs "quality for storage" divergence to keep in sync.
 *
 * MOBILE FIX (this revision): the original implementation read the FULL,
 * un-resized file into a base64 data URL via FileReader *before* decoding
 * it into an <img> for resizing — meaning a multi-megabyte base64 string
 * was always materialized first, even though only the final, much-smaller
 * resized data URL is ever used. On mobile Chrome/Safari/Samsung Internet
 * this large intermediate string, combined with decoding a large image
 * from a data: URL (as opposed to an object URL), was unreliable enough to
 * produce corrupt/incomplete image data on some devices, surfacing later
 * as the browser's own unexplained "Failed to load" for the affected
 * preview/analysis image. The fix: decode straight from the File/Blob via
 * `URL.createObjectURL()` + `<img>` + canvas (the same object-URL approach
 * already used elsewhere in this app for instant previews), resize FIRST,
 * and only ever produce a data URL from the small, resized canvas. The
 * object URL is always revoked once decoding finishes (success or
 * failure). A decode timeout guards against a stalled/never-firing
 * load on mobile. The output contract — a single Promise<string> resolving
 * to a `data:image/...;base64,...` URL — is unchanged, so callers
 * (UploadZoneSection.tsx, sessionStorage persistence, /api/analyze via
 * parseImageDataUrl) require no changes.
 */

/** Long-edge cap in pixels. 2000px is well above what's needed to read
 * small printed text (batch numbers, MRP, license numbers) on a label
 * photographed at a normal distance, while keeping file size small enough
 * to reliably fit in browser storage. */
const MAX_DIMENSION_PX = 2000;

/** JPEG quality (0-1). 0.85 keeps fine printed text sharp while still
 * compressing meaningfully compared to a camera's default JPEG output. */
const JPEG_QUALITY = 0.85;

/** Max time to wait for the object-URL image to decode before giving up
 * and falling back to a direct file read. Guards against a stalled/never-
 * firing `onload`/`onerror` on mobile, which would otherwise hang the
 * upload indefinitely. */
const DECODE_TIMEOUT_MS = 8000;

/**
 * Reads a File directly into a raw (un-resized) base64 data URL. Used ONLY
 * as a fallback/passthrough — never as the primary decode path — so a
 * large intermediate base64 string is created at most once, and only when
 * genuinely needed (decode failure, or the image is already small enough
 * that resizing would just re-encode it for no benefit).
 */
function fileToRawDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read image'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

/**
 * Reads a File and returns an optimized JPEG data URL: downscaled to fit
 * within MAX_DIMENSION_PX on its longest edge (never upscaled) and
 * re-encoded at JPEG_QUALITY. Decodes directly from the file via an object
 * URL (mobile-reliable) rather than a base64 data URL, and resizes BEFORE
 * any data URL is produced. Falls back to the original file's raw data URL
 * if image decoding/canvas encoding fails or times out for any reason —
 * never blocks the upload just because compression didn't work.
 */
export const fileToOptimizedDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    let objectUrl: string;
    try {
      objectUrl = URL.createObjectURL(file);
    } catch {
      // Couldn't even create an object URL — fall back to a direct read.
      fileToRawDataUrl(file)
        .then(resolve)
        .catch(() => resolve(''));
      return;
    }

    let settled = false;

    const cleanupAndResolve = (value: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      URL.revokeObjectURL(objectUrl);
      resolve(value);
    };

    // Fallback / passthrough: read the original file directly. Used both
    // for genuine decode failures and for the "already small enough,
    // already a JPEG" passthrough case below, so the original bytes are
    // preserved untouched rather than generationally re-encoded.
    const fallbackToRawFile = () => {
      if (settled) return;
      clearTimeout(timeoutId);
      fileToRawDataUrl(file)
        .then(cleanupAndResolve)
        .catch(() => cleanupAndResolve(''));
    };

    const timeoutId = setTimeout(() => {
      fallbackToRawFile();
    }, DECODE_TIMEOUT_MS);

    const img = new Image();

    img.onerror = () => {
      // Couldn't decode for resizing — fall back to the untouched
      // original rather than failing the whole upload.
      fallbackToRawFile();
    };

    img.onload = () => {
      try {
        const { naturalWidth: w, naturalHeight: h } = img;

        if (!w || !h) {
          fallbackToRawFile();
          return;
        }

        const scale = Math.min(1, MAX_DIMENSION_PX / Math.max(w, h));

        // Already small enough and already a JPEG — no point re-encoding
        // and potentially generationally degrading it. Read the original
        // bytes directly rather than round-tripping through canvas.
        if (scale === 1 && file.type === 'image/jpeg') {
          fallbackToRawFile();
          return;
        }

        const targetW = Math.max(1, Math.round(w * scale));
        const targetH = Math.max(1, Math.round(h * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          fallbackToRawFile();
          return;
        }

        ctx.drawImage(img, 0, 0, targetW, targetH);

        const optimized = canvas.toDataURL('image/jpeg', JPEG_QUALITY);

        if (!optimized) {
          fallbackToRawFile();
          return;
        }

        cleanupAndResolve(optimized);
      } catch {
        fallbackToRawFile();
      }
    };

    img.src = objectUrl;
  });
};

/** Rough byte size of a data URL's decoded payload, used only to decide
 * whether a persistence attempt is worth trying / to size log messages —
 * never used to silently drop data. */
export const estimateDataUrlBytes = (dataUrl: string): number => {
  const base64 = dataUrl.split(',')[1] || '';
  return Math.round((base64.length * 3) / 4);
};
