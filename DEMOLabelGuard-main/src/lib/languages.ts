/**
 * The main Indian languages Ask LabelGuard supports, plus English. `code`
 * is the value sent to `/api/copilot` and validated there against this
 * same list (see route.ts) — never trust an arbitrary client-sent string.
 * `speechLocale` is the BCP-47 tag passed to the browser's SpeechRecognition
 * and speechSynthesis APIs; actual support for a given locale still
 * depends on the user's browser/OS and is detected at runtime, never
 * assumed here (see useSpeechRecognition / useSpeechSynthesis).
 */
export interface SupportedLanguage {
  code: string;
  /** English name, used as a fallback label. */
  label: string;
  /** Name in the language's own script. */
  nativeLabel: string;
  /** BCP-47 locale for browser speech APIs. */
  speechLocale: string;
  /** Whether chat text in this language should render right-to-left. */
  rtl?: boolean;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', speechLocale: 'en-IN' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', speechLocale: 'hi-IN' },
  { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা', speechLocale: 'bn-IN' },
  { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు', speechLocale: 'te-IN' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी', speechLocale: 'mr-IN' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்', speechLocale: 'ta-IN' },
  { code: 'ur', label: 'Urdu', nativeLabel: 'اردو', speechLocale: 'ur-IN', rtl: true },
  { code: 'gu', label: 'Gujarati', nativeLabel: 'ગુજરાતી', speechLocale: 'gu-IN' },
  { code: 'kn', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ', speechLocale: 'kn-IN' },
  { code: 'ml', label: 'Malayalam', nativeLabel: 'മലയാളം', speechLocale: 'ml-IN' },
  { code: 'pa', label: 'Punjabi', nativeLabel: 'ਪੰਜਾਬੀ', speechLocale: 'pa-IN' },
  { code: 'or', label: 'Odia', nativeLabel: 'ଓଡ଼ିଆ', speechLocale: 'or-IN' },
];

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

export const DEFAULT_LANGUAGE_CODE: LanguageCode = 'en';

const LANGUAGE_CODE_SET = new Set<string>(SUPPORTED_LANGUAGES.map((l) => l.code));

export const isSupportedLanguageCode = (value: unknown): value is LanguageCode =>
  typeof value === 'string' && LANGUAGE_CODE_SET.has(value);

export const getLanguage = (code: string | null | undefined): SupportedLanguage =>
  SUPPORTED_LANGUAGES.find((l) => l.code === code) ??
  (SUPPORTED_LANGUAGES.find((l) => l.code === DEFAULT_LANGUAGE_CODE) as SupportedLanguage);

/** Namespaced with the same `labelguard:` prefix the rest of the app
 * already uses for client-only storage (see realProduct.ts, storyMode
 * provider). */
export const LANGUAGE_STORAGE_KEY = 'labelguard:copilot-language';

// Note: the persistence helpers + `useCopilotLanguage` hook live in
// `src/lib/useCopilotLanguage.ts`, not here. This file is imported by the
// server-side `/api/copilot` route (for validation/labels) as well as by
// client components, so it deliberately has zero React/browser
// dependencies — keeping the hook in its own client-only module avoids
// pulling React and localStorage access into the API route's bundle.
