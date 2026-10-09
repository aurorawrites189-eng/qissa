/**
 * Server-side notification writer.
 *
 * ALWAYS call with the service-role client (createAdminClient): the
 * notifications table has no public INSERT policy (inserts come from
 * trusted backend code only), so a regular RLS client would be rejected.
 * Failures are logged, never thrown — a missed notification must not break
 * the action that triggered it.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Known notification types. Payload shapes are documented per producer. */
export type NotificationType =
  | "originality_passed" // { postId, title, score }
  | "originality_flagged" // { postId, title, score, similarTitles: string[] }
  | "originality_withheld" // { postId, title, score, violationId }
  | "strike_warning" // { violationId, strikeCount, remaining }
  | "suspended" // { violationId, strikeCount, until }
  | "unsuspended" // { reason? }
  | "appeal_overturned" // { appealId, violationId }
  | "appeal_rejected" // { appealId, violationId }
  | "moderation_approved" // { postId, title, reason? }
  | "moderation_rejected" // { postId, title, reason? }
  | "kids_approved" // { postId, title }
  | "new_follower" // { followerId, followerUsername }
  | "new_comment" // { postId, title, commentId, commenterUsername }
  | "report_received"; // { reportId, postId }

export async function notify(
  admin: SupabaseClient,
  userId: string,
  type: NotificationType,
  payload: Record<string, unknown> = {}
): Promise<boolean> {
  const { error } = await admin.from("notifications").insert({
    user_id: userId,
    type,
    payload,
  });
  if (error) {
    console.error(`[notify] failed for user ${userId} type ${type}:`, error.message);
    return false;
  }
  return true;
}
