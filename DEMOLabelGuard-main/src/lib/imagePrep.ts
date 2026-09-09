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
 */

/** Long-edge cap in pixels. 2000px is well above what's needed to read
 * small printed text (batch numbers, MRP, license numbers) on a label
 * photographed at a normal distance, while keeping file size small enough
 * to reliably fit in browser storage. */
const MAX_DIMENSION_PX = 2000;

/** JPEG quality (0-1). 0.85 keeps fine printed text sharp while still
 * compressing meaningfully compared to a camera's default JPEG output. */
const JPEG_QUALITY = 0.85;

/**
 * Reads a File and returns an optimized JPEG data URL: downscaled to fit
 * within MAX_DIMENSION_PX on its longest edge (never upscaled) and
 * re-encoded at JPEG_QUALITY. Falls back to the original file's raw data
 * URL if image decoding/canvas encoding fails for any reason (e.g. an
 * unusual format the browser's <img>/<canvas> pipeline can't round-trip) —
 * never blocks the upload just because compression didn't work.
 */
export const fileToOptimizedDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Unable to read image'));

    reader.onload = () => {
      const rawDataUrl = String(reader.result);

      const img = new Image();

      img.onerror = () => {
        // Couldn't decode for resizing — fall back to the untouched
        // original rather than failing the whole upload.
        resolve(rawDataUrl);
      };

      img.onload = () => {
        try {
          const { naturalWidth: w, naturalHeight: h } = img;

          if (!w || !h) {
            resolve(rawDataUrl);
            return;
          }

          const scale = Math.min(1, MAX_DIMENSION_PX / Math.max(w, h));
          const targetW = Math.max(1, Math.round(w * scale));
          const targetH = Math.max(1, Math.round(h * scale));

          // Already small enough and already a JPEG — no point
          // re-encoding and potentially generationally degrading it.
          if (scale === 1 && file.type === 'image/jpeg') {
            resolve(rawDataUrl);
            return;
          }

          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(rawDataUrl);
            return;
          }

          ctx.drawImage(img, 0, 0, targetW, targetH);

          const optimized = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
          resolve(optimized || rawDataUrl);
        } catch {
          resolve(rawDataUrl);
        }
      };

      img.src = rawDataUrl;
    };

    reader.readAsDataURL(file);
  });
};

/** Rough byte size of a data URL's decoded payload, used only to decide
 * whether a persistence attempt is worth trying / to size log messages —
 * never used to silently drop data. */
export const estimateDataUrlBytes = (dataUrl: string): number => {
  const base64 = dataUrl.split(',')[1] || '';
  return Math.round((base64.length * 3) / 4);
};
