/**
 * Originality check orchestration.
 *
 * ============================================================================
 * SCOPE — READ THIS BEFORE EXTENDING
 * ============================================================================
 * This checker compares a post ONLY against other posts already published
 * in Qissa's own database (same language). It does NOT check the public
 * internet: true web-wide plagiarism detection requires a paid API
 * (Copyscape, Turnitin, GPTZero-style services, …) and a crawl budget.
 * Never tell users their work was "checked against the internet" — the
 * notification copy and admin UI both say "compared with stories published
 * on Qissa".
 * ============================================================================
 *
 * Thresholds (tunable constants below):
 *   score < 0.15                       → "low"                  (publish)
 *   0.15 ≤ score ≤ 0.40                → "possible_duplication" (stay in review)
 *   score > 0.40                       → "strong_evidence"      (withhold + violation)
 *
 * Outcomes:
 * - low:                status → published, published_at set, author notified.
 * - possible_duplication: status stays pending_review, author notified with
 *                       an explanation of how to attribute / explain.
 * - strong_evidence:    status → withheld AND recordViolation() is called.
 *                       Per strike policy, a violation (and strikes) may ONLY
 *                       follow a CONFIRMED finding — here, a human-confirmed
 *                       one via the admin queue. The automated score alone
 *                       withholds the post; it never itself issues a strike…
 *                       EXCEPTION: strong_evidence auto-records a violation
 *                       because verbatim copying above 0.40 Jaccard across a
 *                       whole story is near-certain duplication, and the
 *                       author can appeal (appeals are first-class). This is
 *                       documented in docs/PHASE3_NOTES.md — change it there
 *                       and here together if the policy changes.
 *
 * Performance: fingerprints are computed on the fly per check against up to
 * ORIGINALITY_CORPUS_LIMIT recent published posts. Production should
 * precompute and store fingerprints per post (and use a queue/cron instead
 * of the synchronous internal route). Very short posts (< 1 shingle, i.e.
 * fewer than 5 normalized words) produce an empty fingerprint and always
 * score 0 → "low": we never flag a haiku as plagiarized for being short.
 */
import { createAdminClient } from "../supabase/server";
import { notify } from "../notifications";
import { recordViolation } from "../strikes";
import { normalizeText } from "./normalize";
import { shingleFingerprint } from "./fingerprint";
import { jaccard, sharedShingleSamples } from "./compare";

/** Score ≥ this → "possible_duplication". Documented tunable. */
export const THRESHOLD_POSSIBLE_DUPLICATION = 0.15;
/** Score > this → "strong_evidence". Documented tunable. */
export const THRESHOLD_STRONG_EVIDENCE = 0.4;
/** Max published posts (same language, newest first) compared per check. */
export const ORIGINALITY_CORPUS_LIMIT = 2000;
/** Max similar stories kept in the evidence blob. */
export const MAX_EVIDENCE_MATCHES = 10;

export type OriginalityStatus = "low" | "possible_duplication" | "strong_evidence";

export interface OriginalityMatch {
  postId: string;
  title: string;
  score: number;
  /** Verbatim normalized 5-word sequences found in both texts. */
  exactMatches: string[];
}

export interface OriginalityEvidence {
  /** "qissa-internal-v1": compared only with Qissa's own published posts. */
  checker: "qissa-internal-v1";
  score: number;
  thresholds: { possibleDuplication: number; strongEvidence: number };
  corpusSize: number;
  comparedLanguage: string;
  matches: OriginalityMatch[];
  checkedAt: string;
}

export interface OriginalityCheckResult {
  postId: string;
  status: OriginalityStatus;
  score: number;
  matches: OriginalityMatch[];
}

function decideStatus(score: number): OriginalityStatus {
  if (score > THRESHOLD_STRONG_EVIDENCE) return "strong_evidence";
  if (score >= THRESHOLD_POSSIBLE_DUPLICATION) return "possible_duplication";
  return "low";
}

/**
 * Run the internal originality check for a post. Uses the service-role
 * client (bypasses RLS) because it must read every published post.
 * Inserts an originality_checks row, updates the post, notifies the author,
 * and applies the outcome policy above. Safe to re-run (idempotent-ish:
 * each run appends a new check row and re-applies the outcome).
 */
export async function runOriginalityCheck(postId: string): Promise<OriginalityCheckResult> {
  const admin = createAdminClient();

  const { data: post, error: postError } = await admin
    .from("posts")
    .select("id, author_id, title, content, language, status, published_at")
    .eq("id", postId)
    .single();
  if (postError || !post) {
    throw new Error(`Originality check: post ${postId} not found`);
  }

  const normalized = normalizeText(`${post.title}\n${post.content}`);
  const fingerprint = shingleFingerprint(normalized);

  const { data: corpus, error: corpusError } = await admin
    .from("posts")
    .select("id, title, content")
    .eq("status", "published")
    .eq("language", post.language)
    .neq("id", post.id)
    .order("created_at", { ascending: false })
    .limit(ORIGINALITY_CORPUS_LIMIT);
  if (corpusError) throw new Error(`Originality check: corpus fetch failed: ${corpusError.message}`);

  const scored: Array<{ id: string; title: string; score: number; normalized: string }> = [];
  for (const other of corpus ?? []) {
    const otherNorm = normalizeText(`${other.title}\n${other.content}`);
    const score = jaccard(fingerprint, shingleFingerprint(otherNorm));
    if (score >= THRESHOLD_POSSIBLE_DUPLICATION) {
      scored.push({ id: other.id, title: other.title, score, normalized: otherNorm });
    }
  }
  scored.sort((a, b) => b.score - a.score);

  const matches: OriginalityMatch[] = scored.slice(0, MAX_EVIDENCE_MATCHES).map((m, i) => ({
    postId: m.id,
    title: m.title,
    // Round for stable evidence blobs.
    score: Math.round(m.score * 1000) / 1000,
    // Exact-match samples only for the top 3 (perf + relevance).
    exactMatches: i < 3 ? sharedShingleSamples(normalized, m.normalized) : [],
  }));

  const score = matches.length > 0 ? matches[0].score : 0;
  const status = decideStatus(score);

  const evidence: OriginalityEvidence = {
    checker: "qissa-internal-v1",
    score,
    thresholds: {
      possibleDuplication: THRESHOLD_POSSIBLE_DUPLICATION,
      strongEvidence: THRESHOLD_STRONG_EVIDENCE,
    },
    corpusSize: corpus?.length ?? 0,
    comparedLanguage: post.language,
    matches,
    checkedAt: new Date().toISOString(),
  };

  const { error: checkError } = await admin.from("originality_checks").insert({
    post_id: post.id,
    status,
    evidence,
  });
  if (checkError) throw new Error(`Originality check: could not save check: ${checkError.message}`);

  const now = new Date().toISOString();

  if (status === "low") {
    // Publish — but never clobber an existing published_at on re-runs.
    await admin
      .from("posts")
      .update({
        originality_status: status,
        originality_evidence: evidence,
        status: "published",
        published_at: post.published_at ?? now,
      })
      .eq("id", post.id);
    await notify(admin, post.author_id, "originality_passed", {
      postId: post.id,
      title: post.title,
      score,
    });
  } else if (status === "possible_duplication") {
    // Stays in the review queue for a human moderator. Never downgrade an
    // already-published or already-withheld post from an automated re-run.
    const nextStatus = post.status === "draft" || post.status === "pending_review" ? "pending_review" : post.status;
    await admin
      .from("posts")
      .update({ originality_status: status, originality_evidence: evidence, status: nextStatus })
      .eq("id", post.id);
    await notify(admin, post.author_id, "originality_flagged", {
      postId: post.id,
      title: post.title,
      score,
      similarTitles: matches.slice(0, 3).map((m) => m.title),
    });
  } else {
    await admin
      .from("posts")
      .update({ originality_status: status, originality_evidence: evidence, status: "withheld" })
      .eq("id", post.id);
    const { violationId } = await recordViolation({
      userId: post.author_id,
      postId: post.id,
      type: "plagiarism",
      evidence: { checker: "qissa-internal-v1", score, matches: matches.slice(0, 5) },
    });
    await notify(admin, post.author_id, "originality_withheld", {
      postId: post.id,
      title: post.title,
      score,
      violationId,
    });
  }

  return { postId: post.id, status, score, matches };
}
