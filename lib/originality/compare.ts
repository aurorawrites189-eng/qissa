/**
 * Similarity comparison for the originality checker.
 *
 * - jaccard(): set overlap of shingle fingerprints, 0..1.
 * - sharedShingleSamples(): verbatim 5-word sequences present in BOTH
 *   texts — these are the "exact matches" shown as evidence to moderators.
 *   Samples come from NORMALIZED text (case/punctuation-insensitive); the
 *   original wording is preserved on the post row itself for review.
 */
import { tokenize } from "./normalize";
import { SHINGLE_SIZE } from "./fingerprint";

/** Jaccard similarity of two shingle sets. Empty-vs-empty scores 0. */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  let intersection = 0;
  for (const h of smaller) {
    if (larger.has(h)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export interface TextMatch {
  postId: string;
  score: number;
}

/**
 * Verbatim shingle sequences shared by two NORMALIZED texts.
 * Returns up to `maxSamples` distinct 5-word samples (deduplicated).
 */
export function sharedShingleSamples(
  normalizedA: string,
  normalizedB: string,
  size: number = SHINGLE_SIZE,
  maxSamples: number = 5
): string[] {
  const wordsA = tokenize(normalizedA);
  const wordsB = tokenize(normalizedB);
  if (wordsA.length < size || wordsB.length < size) return [];

  const shinglesB = new Set<string>();
  for (let i = 0; i + size <= wordsB.length; i++) {
    shinglesB.add(wordsB.slice(i, i + size).join(" "));
  }

  const samples: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i + size <= wordsA.length && samples.length < maxSamples; i++) {
    const seq = wordsA.slice(i, i + size).join(" ");
    if (shinglesB.has(seq) && !seen.has(seq)) {
      seen.add(seq);
      samples.push(seq);
    }
  }
  return samples;
}
