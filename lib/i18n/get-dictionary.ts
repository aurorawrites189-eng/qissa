import type { Locale } from "../site-config";
import type { Dictionary } from "./types";
import enSocial from "./dictionaries/en.social.json";
import urSocial from "./dictionaries/ur.social.json";

/**
 * Phase 3 merge: base dictionaries (en.json / ur.json — owned by Phase 1/2)
 * are deep-merged with the Phase 3 social strings (en.social.json /
 * ur.social.json). The social files must keep identical key trees (enforced
 * by the _assertSocialParity check in types.ts).
 *
 * RECONCILIATION NOTE for a later step: if Phase 2+3 dictionaries ever need
 * to become a single file per locale, concatenate each social file's
 * top-level keys (reader, social, comments, notifications, appeals, search,
 * admin) into the base file — they were chosen to NOT collide with base
 * keys, so a shallow top-level merge is sufficient. Then delete the
 * *.social.json files, drop deepMerge, and simplify types.ts.
 */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function deepMerge(base: Record<string, unknown>, overlay: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    const existing = out[key];
    out[key] = isPlainObject(existing) && isPlainObject(value) ? deepMerge(existing, value) : value;
  }
  return out;
}

const SOCIAL: Record<Locale, typeof enSocial> = { en: enSocial, ur: urSocial };

/**
 * Loads the dictionary for a locale.
 *
 * Adding a language only requires the JSON file (dictionaries/<code>.json,
 * same shape as en.json) plus one entry in SUPPORTED_LOCALES
 * (lib/i18n/config.ts) — this dynamic import resolves it with no other
 * code changes. (Phase 3: also add dictionaries/<code>.social.json and one
 * entry in the SOCIAL map above.)
 */
export async function getDictionary(locale: Locale): Promise<Dictionary> {
  const mod = await import(`./dictionaries/${locale}.json`);
  return deepMerge(mod.default as Record<string, unknown>, SOCIAL[locale] as unknown as Record<string, unknown>) as Dictionary;
}
