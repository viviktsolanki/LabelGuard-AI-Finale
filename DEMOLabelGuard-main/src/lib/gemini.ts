import { GoogleGenAI } from '@google/genai';

/**
 * Shared, server-only Gemini client + config for LabelGuard AI.
 *
 * Both /api/analyze and /api/copilot import from here so there is exactly
 * ONE place that knows the provider, the model name(s), and how to read
 * the API key — mirroring how both routes previously shared the same
 * `openai` client shape. Never import this file from client components;
 * it reads GEMINI_API_KEY, which must never reach the browser.
 */

// Single model for both routes: gemini-3.5-flash is Google's current
// GA (generally available), non-preview Gemini model as of this
// migration. It supports multimodal (image) input for /api/analyze and
// fast conversational/multilingual text for /api/copilot, so one model
// covers both use cases without scattering model choices. Kept behind an
// env override + constant (never hardcoded inline in the routes) so it's
// a one-line change later if needed.
export const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash';

let cachedClient: GoogleGenAI | null = null;

/**
 * Lazily creates (and caches) the GoogleGenAI client. Lazy so that a
 * missing GEMINI_API_KEY doesn't crash the whole server at import time —
 * it instead surfaces as a normal, honest per-request error the first
 * time a route tries to use it (see getGeminiErrorMessage below).
 */
export function getGeminiClient(): GoogleGenAI {
  if (!cachedClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new GeminiConfigError('GEMINI_API_KEY is not configured.');
    }
    cachedClient = new GoogleGenAI({ apiKey });
  }
  return cachedClient;
}

export class GeminiConfigError extends Error {}

/** Parsed shape of a `data:<mime>;base64,<data>` URL, ready for Gemini's
 * `inlineData` image parts. */
export interface ParsedDataUrl {
  mimeType: string;
  data: string;
}

// No "s" (dotAll) flag: this project's tsconfig targets ES2017, which
// predates that flag. Base64 data URL payloads never contain newlines,
// so a plain "." still matches the whole payload correctly.
const DATA_URL_PATTERN = /^data:([^;,]+);base64,(.+)$/;

/**
 * Converts a browser-produced `data:image/jpeg;base64,...` string (the
 * same data URLs already produced by src/lib/imagePrep.ts for uploads,
 * camera captures, and extracted video frames) into the
 * `{ mimeType, data }` shape Gemini's inlineData parts expect. Throws on
 * anything that isn't a well-formed base64 data URL so callers can
 * reject bad input the same way the old code implicitly did by handing
 * a bad `image_url` straight to OpenAI.
 */
export function parseImageDataUrl(dataUrl: string): ParsedDataUrl {
  const match = DATA_URL_PATTERN.exec(dataUrl);
  if (!match) {
    throw new Error('Invalid image data URL.');
  }
  return { mimeType: match[1], data: match[2] };
}

/**
 * Strips optional ```json / ``` markdown fences some models wrap JSON
 * output in. Gemini's `responseMimeType: "application/json"` config
 * (used in /api/analyze) should prevent this in practice, but we defend
 * against it anyway per the "never crash on markdown-wrapped JSON" rule.
 */
export function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenced ? fenced[1].trim() : trimmed;
}

/**
 * Maps a thrown Gemini/GoogleGenAI error (or config error) to a safe,
 * honest, user-facing message — never the raw provider error/stack,
 * never a fabricated success. `fallback` is the existing
 * feature-specific honest-error string (see route files) used when the
 * error doesn't match a more specific known case.
 */
export function getGeminiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof GeminiConfigError) {
    return 'Label analysis is not configured on this server. Please set GEMINI_API_KEY.';
  }

  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (
    lower.includes('api key not valid') ||
    lower.includes('api_key_invalid') ||
    lower.includes('permission_denied')
  ) {
    return "The AI provider rejected the server's API key. Please check GEMINI_API_KEY.";
  }
  if (lower.includes('resource_exhausted') || lower.includes('quota') || lower.includes('429')) {
    return 'The AI provider is temporarily rate-limited or out of quota. Please try again shortly.';
  }
  if (
    lower.includes('unavailable') ||
    lower.includes('timeout') ||
    lower.includes('network') ||
    lower.includes('fetch failed')
  ) {
    return 'The AI provider is temporarily unreachable. Please try again.';
  }

  return fallback;
}
