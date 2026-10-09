/**
 * Shingling: text → set of hashed 5-word shingles ("winnowing-lite").
 *
 * A shingle is SHINGLE_SIZE consecutive words; each is hashed with FNV-1a
 * (fast, non-cryptographic — these are similarity fingerprints, not
 * security hashes). Two texts sharing many shingles are likely copied.
 */
import { tokenize } from "./normalize";

/** Number of consecutive words per shingle. Tunable: larger = stricter. */
export const SHINGLE_SIZE = 5;

/** FNV-1a 32-bit hash → 8-char hex string. */
export function fnv1a(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    // Math.imul keeps 32-bit multiplication exact.
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Fingerprint of NORMALIZED text (run it through normalizeText first).
 * Returns the set of hashed shingles; empty set when the text is shorter
 * than one shingle (very short posts are never flagged — documented in
 * runOriginalityCheck).
 */
export function shingleFingerprint(normalized: string, size: number = SHINGLE_SIZE): Set<string> {
  const words = tokenize(normalized);
  const set = new Set<string>();
  if (words.length < size) return set;
  for (let i = 0; i + size <= words.length; i++) {
    set.add(fnv1a(words.slice(i, i + size).join(" ")));
  }
  return set;
}
