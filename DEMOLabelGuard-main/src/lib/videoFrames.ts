/**
 * Video / 360° product scanning — client-side video validation and frame
 * extraction.
 *
 * ARCHITECTURE (see PHASE 1 spec): this module never talks to the existing
 * AI analysis pipeline. Its only job is:
 *
 *   raw video File -> validate -> sample candidate frames (cheap) ->
 *   score + de-duplicate -> extract N winning timestamps at full
 *   resolution -> return plain `File[]` (JPEG)
 *
 * Those returned Files are indistinguishable from a normal camera/upload
 * photo File once handed back to UploadZoneSection — they go through the
 * exact same `fileToOptimizedDataUrl` / sessionStorage / /api/analyze path
 * as a manually-picked front/back/additional image. This file intentionally
 * has zero knowledge of imagePrep.ts, mockData.ts, or the analyze route.
 *
 * HONESTY NOTE (do not remove): the "quality" and "duplicate" checks below
 * are cheap heuristics, not real computer vision. Sharpness is approximated
 * from a downscaled grayscale gradient (a fast proxy for variance-of-
 * Laplacian, not the real thing), and similarity is an 8x8 average-hash —
 * both can be wrong on flat-but-sharp labels, noisy low-light video, or
 * subtly different frames that hash identically. There is no true 3D
 * understanding of the product here: frames are chosen by spreading picks
 * across time + maximizing a hash-distance from frames already picked,
 * which approximates "different views" without knowing what a "view" is.
 */

// ─── LIMITS ──────────────────────────────────────────────────────────────
// These intentionally do NOT match imagePrep.ts's MAX_DIMENSION_PX (2000px)
// or the 10MB still-image cap — video is a different medium. They are
// video-specific and documented individually below.

/** Max recording/upload duration. Chosen because a slow, deliberate 360°
 * rotation of a hand-held product realistically takes 15-25s; 30s gives
 * headroom without inviting multi-minute uploads that would blow the
 * candidate-sampling budget below. */
export const MAX_VIDEO_DURATION_SECONDS = 30;

/** Max accepted file size for an uploaded (not recorded) video. Phone
 * H.264 video at 1080p typically runs 6-10 MB per 10s, so a 30s clip is
 * usually well under 50MB; 150MB leaves headroom for higher-bitrate
 * exports (e.g. an unedited 4K clip) without accepting something so large
 * it risks exhausting memory when decoded on a mid-range phone browser. */
export const MAX_VIDEO_FILE_SIZE_BYTES = 150 * 1024 * 1024;

/** How many still frames we ultimately hand to the existing photo
 * pipeline. Deliberately NOT a made-up number: it equals the existing
 * pipeline's real capacity (front + back + additional views), imported by
 * the caller from mockData.ts rather than hardcoded here, so this module
 * never silently drifts out of sync with the actual UI limit. Kept here
 * only as a hard ceiling in case a caller passes something larger. */
export const ABSOLUTE_MAX_FINAL_FRAMES = 6;

/** Long-edge cap (px) for the final, full-resolution extracted frames.
 * imagePrep.ts will downscale/re-encode again on its own terms (2000px,
 * JPEG 0.85) before anything reaches storage or the AI, so this only needs
 * to be "enough detail for imagePrep to have something good to start
 * from," not the final word on quality. 1920px matches common 1080p/portrait
 * phone video and avoids the two systems fighting each other. */
const FRAME_EXTRACTION_MAX_DIMENSION_PX = 1920;

/** Low-res working size (px, long edge) used ONLY for pass-1 candidate
 * sampling — sharpness scoring and hashing. Keeping this tiny is what
 * makes it safe to sample dozens of candidates without ever holding more
 * than one small canvas in memory at a time. */
const CANDIDATE_SAMPLE_MAX_DIMENSION_PX = 160;

/** Pass-1 sampling interval. Every 0.4s over a 30s video is ~75 candidates
 * max — cheap at 160px each, one at a time, never all held simultaneously. */
const CANDIDATE_SAMPLE_INTERVAL_SECONDS = 0.4;

/** Hard ceiling on candidates regardless of duration, as a defensive bound
 * against unexpected metadata (e.g. a duration that reads longer than the
 * validated max due to a container/browser quirk). */
const MAX_CANDIDATES = 90;

/** Average-hash Hamming distance (0-64) below which two candidate frames
 * are treated as "too similar to both be worth keeping." Chosen loosely —
 * see honesty note at the top of this file. */
const DUPLICATE_HASH_DISTANCE_THRESHOLD = 8;

/** Timeout for a single `seeked` event before we give up on that
 * timestamp. Prevents an infinite spinner if the browser's decoder stalls
 * on a particular frame. */
const SEEK_TIMEOUT_MS = 4000;

// ─── TYPES ───────────────────────────────────────────────────────────────

export type VideoErrorCode =
  | 'not-a-video'
  | 'file-too-large'
  | 'metadata-failed'
  | 'video-too-long'
  | 'zero-duration'
  | 'decode-failed'
  | 'no-usable-frames'
  | 'extraction-failed';

export class VideoProcessingError extends Error {
  code: VideoErrorCode;

  constructor(code: VideoErrorCode, message: string) {
    super(message);
    this.name = 'VideoProcessingError';
    this.code = code;
  }
}

/** User-facing copy for each error code. Kept in one place so every
 * surface (upload validation, recording, extraction) shows consistent,
 * non-technical messages — never a raw stack trace. */
export const VIDEO_ERROR_MESSAGES: Record<VideoErrorCode, string> = {
  'not-a-video': 'Please upload a video file (MP4, WebM, or MOV).',
  'file-too-large': `This video file is too large. Please keep it under ${Math.round(
    MAX_VIDEO_FILE_SIZE_BYTES / (1024 * 1024)
  )}MB.`,
  'metadata-failed': "We couldn't read this video. Try uploading another video or use Photo Scan.",
  'video-too-long': `This video is too long. Please record a short rotation of the product (max ${MAX_VIDEO_DURATION_SECONDS} seconds).`,
  'zero-duration':
    "This video doesn't seem to have any playable content. Try another video or use Photo Scan.",
  'decode-failed': "We couldn't process this video. Try uploading another video or use Photo Scan.",
  'no-usable-frames':
    "We couldn't find any usable frames in this video. Try recording with better lighting, or use Photo Scan.",
  'extraction-failed':
    'Something went wrong while extracting frames from your video. Please try again.',
};

export interface VideoMetadata {
  durationSeconds: number;
  width: number;
  height: number;
}

/** A single extracted, full-resolution still frame ready to be treated
 * exactly like a manually-captured/uploaded photo. */
export interface ExtractedFrame {
  /** Stable id for React keys / removal, not related to mockData ids. */
  id: string;
  timestampSeconds: number;
  file: File;
  previewUrl: string;
  /** 0-1 relative sharpness score among this video's candidates, for
   * optional display/debugging. Not a calibrated absolute quality score. */
  sharpness: number;
}

export interface FrameExtractionProgress {
  stage: 'sampling' | 'selecting' | 'extracting';
  /** 0-1 */
  fraction: number;
}

// ─── VALIDATION ──────────────────────────────────────────────────────────

/** Cheap, synchronous-ish checks that don't require decoding the video. */
export function validateVideoFile(file: File): void {
  const looksLikeVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(file.name);

  if (!looksLikeVideo) {
    throw new VideoProcessingError('not-a-video', VIDEO_ERROR_MESSAGES['not-a-video']);
  }

  if (file.size > MAX_VIDEO_FILE_SIZE_BYTES) {
    throw new VideoProcessingError('file-too-large', VIDEO_ERROR_MESSAGES['file-too-large']);
  }
}

/** Loads just enough of the video to read duration/dimensions, without
 * decoding frames. Rejects with a typed error if metadata can't be read or
 * the duration exceeds the max. Caller is responsible for revoking the
 * object URL it passes in once done (readVideoMetadata does not create
 * one itself, to avoid a double-URL-per-video existing in memory). */
export function readVideoMetadata(objectUrl: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.src = objectUrl;

    const cleanup = () => {
      video.onloadedmetadata = null;
      video.onerror = null;
    };

    video.onloadedmetadata = () => {
      const durationSeconds = video.duration;
      cleanup();

      if (!isFinite(durationSeconds) || durationSeconds <= 0) {
        reject(new VideoProcessingError('zero-duration', VIDEO_ERROR_MESSAGES['zero-duration']));
        return;
      }

      if (durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
        reject(new VideoProcessingError('video-too-long', VIDEO_ERROR_MESSAGES['video-too-long']));
        return;
      }

      resolve({
        durationSeconds,
        width: video.videoWidth,
        height: video.videoHeight,
      });
    };

    video.onerror = () => {
      cleanup();
      reject(new VideoProcessingError('metadata-failed', VIDEO_ERROR_MESSAGES['metadata-failed']));
    };
  });
}

// ─── SEEK HELPER ─────────────────────────────────────────────────────────

function seekTo(video: HTMLVideoElement, timeSeconds: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      reject(new Error(`Seek timed out at ${timeSeconds}s`));
    }, SEEK_TIMEOUT_MS);

    const onSeeked = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      resolve();
    };

    const onError = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      reject(new Error('Video decode error while seeking'));
    };

    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    video.currentTime = timeSeconds;
  });
}

// ─── PASS 1: CANDIDATE SAMPLING ──────────────────────────────────────────

/** 8x8 average hash as 64 bits (0/1), stored plainly rather than packed
 * into a bigint — this project targets ES2017, and 64 booleans is cheap
 * enough that packing buys nothing worth a language-target bump. */
type FrameHash = Uint8Array;

interface Candidate {
  timestampSeconds: number;
  sharpness: number;
  hash: FrameHash;
}

/** Downscales the current video frame onto a tiny canvas and returns both
 * a sharpness score and a perceptual hash. Only one small canvas/ImageData
 * exists at a time — nothing here is retained across candidates. */
function scoreCurrentFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement
): {
  sharpness: number;
  hash: FrameHash;
} {
  const vw = video.videoWidth || 1;
  const vh = video.videoHeight || 1;
  const scale = CANDIDATE_SAMPLE_MAX_DIMENSION_PX / Math.max(vw, vh);
  const w = Math.max(8, Math.round(vw * scale));
  const h = Math.max(8, Math.round(vh * scale));

  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { sharpness: 0, hash: new Uint8Array(64) };

  ctx.drawImage(video, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  // Grayscale buffer, reused for both sharpness and hashing.
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  // Sharpness proxy: mean absolute gradient magnitude (fast stand-in for
  // variance-of-Laplacian — see honesty note at top of file).
  let gradientSum = 0;
  let gradientCount = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const gx = gray[idx + 1] - gray[idx - 1];
      const gy = gray[idx + w] - gray[idx - w];
      gradientSum += Math.abs(gx) + Math.abs(gy);
      gradientCount++;
    }
  }
  const sharpness = gradientCount > 0 ? gradientSum / gradientCount : 0;

  // 8x8 average hash for cheap similarity comparison.
  const hashSize = 8;
  const small = new Float32Array(hashSize * hashSize);
  for (let hy = 0; hy < hashSize; hy++) {
    for (let hx = 0; hx < hashSize; hx++) {
      const srcX = Math.min(w - 1, Math.floor((hx / hashSize) * w));
      const srcY = Math.min(h - 1, Math.floor((hy / hashSize) * h));
      small[hy * hashSize + hx] = gray[srcY * w + srcX];
    }
  }
  let mean = 0;
  for (let i = 0; i < small.length; i++) mean += small[i];
  mean /= small.length;

  const hash = new Uint8Array(hashSize * hashSize);
  for (let i = 0; i < small.length; i++) {
    hash[i] = small[i] >= mean ? 1 : 0;
  }

  return { sharpness, hash };
}

function hammingDistance(a: FrameHash, b: FrameHash): number {
  let count = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) count++;
  }
  return count;
}

async function sampleCandidates(
  video: HTMLVideoElement,
  durationSeconds: number,
  onProgress?: (progress: FrameExtractionProgress) => void
): Promise<Candidate[]> {
  const canvas = document.createElement('canvas');
  const candidates: Candidate[] = [];

  const rawCount = Math.floor(durationSeconds / CANDIDATE_SAMPLE_INTERVAL_SECONDS);
  const sampleCount = Math.max(1, Math.min(MAX_CANDIDATES, rawCount));
  // Avoid sampling the very first/last few frames, which are frequently
  // hand motion blur as the user starts/stops recording.
  const startPad = Math.min(0.3, durationSeconds * 0.05);
  const endPad = Math.min(0.3, durationSeconds * 0.05);
  const usableSpan = Math.max(0.01, durationSeconds - startPad - endPad);

  for (let i = 0; i < sampleCount; i++) {
    const t = startPad + (usableSpan * i) / Math.max(1, sampleCount - 1);

    try {
      await seekTo(video, t);
    } catch {
      // Skip an unseekable timestamp rather than failing the whole video —
      // a handful of bad seeks shouldn't sink an otherwise-fine video.
      continue;
    }

    const { sharpness, hash } = scoreCurrentFrame(video, canvas);
    candidates.push({ timestampSeconds: t, sharpness, hash });

    onProgress?.({ stage: 'sampling', fraction: (i + 1) / sampleCount });
  }

  return candidates;
}

// ─── SELECTION ───────────────────────────────────────────────────────────

/** Greedy selection: start from the sharpest candidate, then repeatedly
 * pick whichever remaining candidate is both reasonably sharp AND most
 * different (by hash distance) from everything already picked. This is
 * the "spread across the rotation + prefer sharp + avoid duplicates"
 * heuristic described in the spec — not true 3D view understanding. */
function selectCandidates(candidates: Candidate[], maxFrames: number): Candidate[] {
  if (candidates.length === 0) return [];

  const sorted = [...candidates].sort((a, b) => b.sharpness - a.sharpness);
  const maxSharpness = sorted[0].sharpness || 1;

  const selected: Candidate[] = [sorted[0]];
  const remaining = sorted.slice(1);

  while (selected.length < maxFrames && remaining.length > 0) {
    let bestIndex = -1;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const minDistance = Math.min(...selected.map((s) => hammingDistance(s.hash, candidate.hash)));

      // Skip near-duplicates of something we already have, unless we're
      // running low on options and need to fill the frame budget anyway.
      const isDuplicate = minDistance < DUPLICATE_HASH_DISTANCE_THRESHOLD;
      if (isDuplicate && remaining.length > maxFrames - selected.length) {
        continue;
      }

      const normalizedSharpness = candidate.sharpness / maxSharpness;
      const normalizedDistance = minDistance / 64;
      // Weight distinctness slightly higher than raw sharpness — the goal
      // is coverage of different views, not just the single sharpest shot.
      const score = normalizedDistance * 0.6 + normalizedSharpness * 0.4;

      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    if (bestIndex === -1) break;
    selected.push(remaining[bestIndex]);
    remaining.splice(bestIndex, 1);
  }

  return selected.sort((a, b) => a.timestampSeconds - b.timestampSeconds);
}

// ─── PASS 2: FULL-RESOLUTION EXTRACTION ─────────────────────────────────

function extractFrameAsFile(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  index: number
): Promise<File> {
  return new Promise((resolve, reject) => {
    const vw = video.videoWidth || 1;
    const vh = video.videoHeight || 1;
    const scale = Math.min(1, FRAME_EXTRACTION_MAX_DIMENSION_PX / Math.max(vw, vh));
    const w = Math.max(1, Math.round(vw * scale));
    const h = Math.max(1, Math.round(vh * scale));

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(
        new VideoProcessingError('extraction-failed', VIDEO_ERROR_MESSAGES['extraction-failed'])
      );
      return;
    }

    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(
            new VideoProcessingError('extraction-failed', VIDEO_ERROR_MESSAGES['extraction-failed'])
          );
          return;
        }
        resolve(new File([blob], `video-frame-${index + 1}.jpg`, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.92
    );
  });
}

// ─── PUBLIC ENTRY POINT ──────────────────────────────────────────────────

/**
 * Full pipeline: validate -> read metadata -> sample -> select -> extract.
 * `maxFrames` should be passed by the caller from the real pipeline
 * capacity (2 + MAX_ADDITIONAL_IMAGES from mockData.ts), not assumed here.
 *
 * The `file` is only read via object URLs created and revoked internally;
 * nothing here writes to sessionStorage/localStorage, and the original
 * video is never retained after this function returns.
 */
export async function extractFramesFromVideo(
  file: File,
  maxFrames: number,
  onProgress?: (progress: FrameExtractionProgress) => void
): Promise<ExtractedFrame[]> {
  validateVideoFile(file);

  const cappedMaxFrames = Math.max(1, Math.min(maxFrames, ABSOLUTE_MAX_FINAL_FRAMES));
  const objectUrl = URL.createObjectURL(file);

  try {
    const metadata = await readVideoMetadata(objectUrl);

    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () =>
        reject(new VideoProcessingError('decode-failed', VIDEO_ERROR_MESSAGES['decode-failed']));
    });

    const candidates = await sampleCandidates(video, metadata.durationSeconds, onProgress);

    if (candidates.length === 0) {
      throw new VideoProcessingError('no-usable-frames', VIDEO_ERROR_MESSAGES['no-usable-frames']);
    }

    onProgress?.({ stage: 'selecting', fraction: 1 });

    const selected = selectCandidates(candidates, cappedMaxFrames);

    const canvas = document.createElement('canvas');
    const frames: ExtractedFrame[] = [];
    const maxSharpness = Math.max(...selected.map((c) => c.sharpness), 1);

    for (let i = 0; i < selected.length; i++) {
      const candidate = selected[i];
      try {
        await seekTo(video, candidate.timestampSeconds);
        const extractedFile = await extractFrameAsFile(video, canvas, i);
        frames.push({
          id: `video-frame-${i}-${Date.now()}`,
          timestampSeconds: candidate.timestampSeconds,
          file: extractedFile,
          previewUrl: URL.createObjectURL(extractedFile),
          sharpness: candidate.sharpness / maxSharpness,
        });
      } catch {
        // Skip a frame that fails full-res extraction rather than failing
        // the whole batch — the user reviews the result and can still
        // proceed with fewer frames, or retry.
        continue;
      }
      onProgress?.({ stage: 'extracting', fraction: (i + 1) / selected.length });
    }

    if (frames.length === 0) {
      throw new VideoProcessingError('no-usable-frames', VIDEO_ERROR_MESSAGES['no-usable-frames']);
    }

    return frames;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Best-effort MIME type detection for MediaRecorder, since browser
 * support varies a lot (notably Safari). Returns undefined if nothing
 * testable is supported, in which case the caller should fall back to
 * "recording unsupported, please upload instead" rather than guessing. */
export function pickSupportedRecordingMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;

  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];

  for (const type of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(type)) return type;
    } catch {
      // isTypeSupported itself can throw in some old browsers.
      continue;
    }
  }

  return undefined;
}
