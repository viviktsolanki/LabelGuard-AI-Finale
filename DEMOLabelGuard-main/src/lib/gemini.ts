import {
  GoogleGenAI,
  type GenerateContentParameters,
  type GenerateContentResponse,
} from '@google/genai';

/**
 * Shared, server-only Gemini client + config for LabelGuard AI.
 *
 * Both /api/analyze and /api/copilot import from here so there is exactly
 * ONE place that knows the provider, the model name(s), and how to read
 * the API key — mirroring how both routes previously shared the same
 * `openai` client shape. Never import this file from client components;
 * it reads GEMINI_API_KEY (and the optional backup/fallback config below),
 * which must never reach the browser.
 */

// Single primary model for both routes: gemini-3.5-flash is Google's
// current GA (generally available), non-preview Gemini model as of this
// migration. It supports multimodal (image) input for /api/analyze and
// fast conversational/multilingual text for /api/copilot, so one model
// covers both use cases without scattering model choices. Kept behind an
// env override + constant (never hardcoded inline in the routes) so it's
// a one-line change later if needed.
export const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash';

// Optional. If a request to GEMINI_MODEL fails after its retry with a
// transient error, and this is set, ONE further attempt is made against
// this model instead. Left unset by default — never invented/guessed
// here, only ever an operator-provided env value. See
// generateWithRetryAndFallback below.
export const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL?.trim() || null;

// Bounded wall-clock timeout for a single Gemini HTTP call, passed via the
// SDK's own `httpOptions.timeout` (milliseconds). Without this, a stalled
// upstream request has no defined ceiling — it would hang for as long as
// the platform's own request/function timeout allows (or indefinitely in
// `next dev`), holding the request open and leaving the user's spinner
// spinning with no honest error. 45s comfortably covers a multi-image
// vision analysis call (the slower of the two routes) while still being
// short enough that a genuinely stuck request fails fast enough for the
// existing retry/fallback logic below to run within a reasonable total
// request time.
export const GEMINI_REQUEST_TIMEOUT_MS = 45_000;

let cachedPrimaryClient: GoogleGenAI | null = null;
let cachedBackupClient: GoogleGenAI | null = null;

/**
 * Lazily creates (and caches) the GoogleGenAI client. Lazy so that a
 * missing GEMINI_API_KEY doesn't crash the whole server at import time —
 * it instead surfaces as a normal, honest per-request error the first
 * time a route tries to use it (see getGeminiErrorMessage below).
 *
 * `useBackupKey`: when true, returns a separately-cached client built
 * from GEMINI_API_KEY_BACKUP instead of GEMINI_API_KEY. Only used by the
 * configured-fallback attempt in generateWithRetryAndFallback, and only
 * when that env var is actually set — this never falls back to the
 * primary key silently.
 */
export function getGeminiClient(useBackupKey = false): GoogleGenAI {
  if (useBackupKey) {
    if (!cachedBackupClient) {
      const backupKey = process.env.GEMINI_API_KEY_BACKUP?.trim();
      if (!backupKey) {
        throw new GeminiConfigError('GEMINI_API_KEY_BACKUP is not configured.');
      }
      cachedBackupClient = new GoogleGenAI({ apiKey: backupKey });
    }
    return cachedBackupClient;
  }

  if (!cachedPrimaryClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new GeminiConfigError('GEMINI_API_KEY is not configured.');
    }
    cachedPrimaryClient = new GoogleGenAI({ apiKey });
  }
  return cachedPrimaryClient;
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
 * True for temporary/transient failures only: HTTP 503 (model
 * overloaded/unavailable), HTTP 429 (rate limited / quota), and
 * network-level failures (timeout, DNS, connection reset, etc). False
 * for everything else — including GeminiConfigError (bad/missing key is
 * an operator problem, not a "try again" problem) and any other
 * non-transient error — so callers know not to burn a retry/fallback
 * attempt on e.g. a bad request or an invalid API key.
 */
export function isRetryableGeminiError(error: unknown): boolean {
  if (error instanceof GeminiConfigError) {
    return false;
  }

  const status =
    typeof (error as { status?: unknown } | null)?.status === 'number'
      ? (error as { status: number }).status
      : typeof (error as { code?: unknown } | null)?.code === 'number'
        ? (error as { code: number }).code
        : null;

  if (status === 503 || status === 429) {
    return true;
  }

  // A request cancelled by our own GEMINI_REQUEST_TIMEOUT_MS (see above)
  // surfaces as a DOMException/Error named "AbortError" — its message
  // text varies by runtime ("The operation was aborted", "This operation
  // was aborted", etc.) and doesn't reliably contain any of the substrings
  // checked below, so this must be checked by name, not just by message.
  const name = (error as { name?: unknown } | null)?.name;
  if (name === 'AbortError') {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  return (
    lower.includes('503') ||
    lower.includes('429') ||
    lower.includes('unavailable') ||
    lower.includes('overloaded') ||
    lower.includes('resource_exhausted') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('aborted') ||
    lower.includes('network') ||
    lower.includes('fetch failed') ||
    lower.includes('econnreset') ||
    lower.includes('econnrefused') ||
    lower.includes('enotfound') ||
    lower.includes('socket hang up')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Short, fixed backoff before the single retry. Not exponential and not
// repeated — this project wants exactly one retry, never an open-ended
// backoff loop.
const RETRY_BACKOFF_MS = 800;

export type GeminiAttemptLabel = 'primary' | 'retry' | 'fallback';

export interface GeminiCallResult<T> {
  result: T;
  model: string;
  attempt: GeminiAttemptLabel;
  usedBackupKey: boolean;
}

/**
 * Runs one Gemini generateContent call with bounded, honest retry
 * behaviour:
 *
 *   1. Attempt with GEMINI_MODEL (primary key).
 *   2. On a transient error (see isRetryableGeminiError): wait a short
 *      fixed backoff, then retry ONCE more — same model, same key.
 *   3. If that retry also fails with a transient error AND an operator
 *      has configured GEMINI_FALLBACK_MODEL and/or GEMINI_API_KEY_BACKUP,
 *      make ONE further attempt against that configured fallback. If
 *      neither is configured, this step is skipped entirely.
 *   4. Otherwise (non-transient error at any step, or the fallback
 *      attempt also fails) the error is thrown for the caller to turn
 *      into an honest message via getGeminiErrorMessage.
 *
 * There is no unbounded/infinite retry loop anywhere in this function —
 * at most 3 network calls are ever made (primary, retry, fallback).
 *
 * `buildParams(model)` builds the {contents, config} for a given model
 * so callers keep full control of the prompt/schema — this function
 * never touches prompt content, only which model/key attempts it.
 * `extract` turns the raw GenerateContentResponse into whatever shape
 * the caller needs; if it throws (e.g. on empty/non-JSON output), that
 * error is treated like any other — retried only if
 * isRetryableGeminiError says it's transient, which a plain "bad output"
 * error will not be.
 */
export async function generateWithRetryAndFallback<T>(
  buildParams: (model: string) => Omit<GenerateContentParameters, 'model'>,
  extract: (response: GenerateContentResponse) => T
): Promise<GeminiCallResult<T>> {
  const primaryModel = GEMINI_MODEL;
  const fallbackModel = GEMINI_FALLBACK_MODEL;
  const hasBackupKey = !!process.env.GEMINI_API_KEY_BACKUP?.trim();

  const attempt = async (
    model: string,
    useBackupKey: boolean,
    label: GeminiAttemptLabel
  ): Promise<GeminiCallResult<T>> => {
    const ai = getGeminiClient(useBackupKey);
    const params = buildParams(model);
    // Apply the shared request timeout without clobbering a timeout the
    // caller may have deliberately set in its own config's httpOptions.
    const config = {
      ...params.config,
      httpOptions: {
        timeout: GEMINI_REQUEST_TIMEOUT_MS,
        ...params.config?.httpOptions,
      },
    };
    const response = await ai.models.generateContent({ model, ...params, config });
    return { result: extract(response), model, attempt: label, usedBackupKey: useBackupKey };
  };

  let lastError: unknown;

  // 1. Primary attempt.
  try {
    return await attempt(primaryModel, false, 'primary');
  } catch (error) {
    lastError = error;
    if (!isRetryableGeminiError(error)) throw error;
  }

  // 2. ONE retry, short fixed backoff, same model/key.
  await sleep(RETRY_BACKOFF_MS);
  try {
    return await attempt(primaryModel, false, 'retry');
  } catch (error) {
    lastError = error;
    if (!isRetryableGeminiError(error)) throw error;
  }

  // 3. ONE configured-fallback attempt, only if an operator configured
  // a fallback model and/or a backup key. Never invents either.
  if (fallbackModel || hasBackupKey) {
    try {
      return await attempt(fallbackModel || primaryModel, hasBackupKey, 'fallback');
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
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
    return 'Label analysis is not configured on this server (server config issue). Please set GEMINI_API_KEY.';
  }

  // Same AbortError-by-name case as isRetryableGeminiError above — our own
  // GEMINI_REQUEST_TIMEOUT_MS cancellation doesn't reliably say "timeout"
  // in its message, so it must be recognized by name to get the honest
  // network-issue message below instead of falling through to `fallback`.
  const name = (error as { name?: unknown } | null)?.name;
  const isAbort = name === 'AbortError';

  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (
    lower.includes('api key not valid') ||
    lower.includes('api_key_invalid') ||
    lower.includes('permission_denied')
  ) {
    return "The AI provider rejected the server's API key (server config issue). Please check GEMINI_API_KEY.";
  }
  if (
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('429') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests')
  ) {
    return 'The AI provider is rate limited right now. Please try again shortly.';
  }
  if (lower.includes('503') || lower.includes('unavailable') || lower.includes('overloaded')) {
    return 'The AI provider is busy right now. Please try again in a moment.';
  }
  if (
    isAbort ||
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('aborted') ||
    lower.includes('network') ||
    lower.includes('fetch failed') ||
    lower.includes('econnreset') ||
    lower.includes('econnrefused') ||
    lower.includes('enotfound') ||
    lower.includes('socket hang up')
  ) {
    return 'A network issue prevented the AI provider from responding. Please try again.';
  }

  return fallback;
}
