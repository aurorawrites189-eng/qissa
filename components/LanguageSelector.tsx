"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";

const LOCALE_LABELS: Record<string, string> = {
  en: "English",
  ur: "اردو",
};

export function LanguageSelector() {
  const { locale, setLocale } = useLanguage();

  return (
    <div
      className="flex items-center gap-1 rounded-lg border border-neutral-300 p-1 dark:border-neutral-700"
      role="group"
      aria-label="Language"
    >
      {SUPPORTED_LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          className={`rounded-md px-2.5 py-1 text-sm transition ${
            locale === l
              ? "bg-emerald-700 text-white dark:bg-emerald-600"
              : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          }`}
        >
          {LOCALE_LABELS[l] ?? l}
        </button>
      ))}
    </div>
  );
}
