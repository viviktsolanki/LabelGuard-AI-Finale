'use client';

import React from 'react';
import { Languages } from 'lucide-react';
import { SUPPORTED_LANGUAGES, type LanguageCode } from '@/lib/languages';

interface LanguageSelectorProps {
  value: LanguageCode;
  onChange: (code: LanguageCode) => void;
  className?: string;
}

/**
 * Single reusable language picker used by both /copilot and the Scan
 * Copilot widget (see CopilotChatPanel). A native <select> on purpose —
 * touch-friendly on mobile, keyboard-accessible, and needs no extra
 * positioning logic inside a small floating widget.
 */
export default function LanguageSelector({ value, onChange, className }: LanguageSelectorProps) {
  return (
    <label className={`inline-flex items-center gap-1.5 min-w-0 ${className ?? ''}`}>
      <Languages size={14} className="text-muted-foreground flex-shrink-0" />
      <span className="sr-only">Answer language</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as LanguageCode)}
        aria-label="Answer language"
        className="text-xs bg-card border border-border rounded-lg px-2 py-1.5 min-w-0 max-w-[10rem] focus:outline-none focus:ring-2 focus:ring-accent/40"
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.nativeLabel === lang.label ? lang.label : `${lang.nativeLabel} · ${lang.label}`}
          </option>
        ))}
      </select>
    </label>
  );
}
