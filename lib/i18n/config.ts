import type { Locale } from "../site-config";

/**
 * Locales the app supports.
 *
 * Adding a language = add `dictionaries/<code>.json` (same shape as
 * en.json) + one entry in this array. `getDictionary` picks the new file
 * up automatically — no other code changes needed.
 *
 * Keep in sync with SITE.locales in lib/site-config.ts.
 */
export const SUPPORTED_LOCALES: Locale[] = ["en", "ur"];

export function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as string[]).includes(value);
}

export const localeDirections: Record<Locale, "ltr" | "rtl"> = {
  en: "ltr",
  ur: "rtl",
};
