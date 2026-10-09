/**
 * Text normalization for the originality checker.
 *
 * Steps: lowercase → Unicode NFKD → strip combining diacritics (Latin
 * accents AND Arabic/Urdu harakat) → replace punctuation/symbols with
 * spaces → collapse whitespace → trim.
 *
 * IMPORTANT: normalization is lossy on purpose (so "Kitab" matches
 * "kitāb" and "کتاب" matches "كِتاب"). The ORIGINAL, un-normalized text
 * is always preserved separately for evidence display and admin review —
 * never show normalized text to users as if it were their writing.
 */
export function normalizeText(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      // Combining marks: Latin accents (U+0300–U+036F), Arabic/Urdu
      // harakat (U+064B–U+065F, U+0670) and extended Arabic marks
      // (U+06D6–U+06ED).
      .replace(/[\u0300-\u036F\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
      // Keep letters and numbers from ANY script (Latin, Arabic/Urdu,
      // digits…); everything else (punctuation, emoji, symbols) becomes
      // a word separator.
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      // Collapse runs of whitespace to a single space.
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** Split normalized text into word tokens. */
export function tokenize(normalized: string): string[] {
  if (!normalized) return [];
  return normalized.split(" ").filter((w) => w.length > 0);
}
