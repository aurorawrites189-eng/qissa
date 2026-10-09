/**
 * Strike / violation system.
 *
 * ============================================================================
 * POLICY — STRIKES ONLY FOLLOW CONFIRMED VIOLATIONS
 * ============================================================================
 * A strike is NEVER issued on an automated score alone. recordViolation()
 * inserts a violation with status 'confirmed' — "confirmed" here means a
 * human moderator confirmed it, OR the qissa-internal-v1 originality
 * checker found verbatim duplication above the strong-evidence threshold
 * (score > 0.40 Jaccard), which policy treats as confirmed plagiarism.
 * Borderline scores ('possible_duplication') only ever hold a post for
 * human review; they never create violations or strikes.
 *
 * Every confirmed violation is appealable, and a successful appeal removes
 * the strike (decideAppeal with overturn=true).
 * ============================================================================
 *
 * Strike ladder:
 *   strike 1–2 → warning notification (with appeal instructions)
 *   strike 3   → account suspended for STRIKE_SUSPENSION_DAYS (30), notified
 *
 * Uses the service-role client throughout: profiles.strike_count /
 * is_suspended are guard-trigger protected (non-admins cannot touch them),
 * and migration 0002 explicitly allows the service_role to write them.
 */
import { createAdminClient } from "./supabase/server";
import { notify } from "./notifications";

/** Strikes that trigger an automatic suspension. Documented tunable. */
export const STRIKES_BEFORE_SUSPENSION = 3;
/** Suspension length in days after the final strike. Documented tunable. */
export const STRIKE_SUSPENSION_DAYS = 30;

export interface RecordViolationInput {
  userId: string;
  postId?: string | null;
  /** e.g. "plagiarism" | "hate_speech" | "spam" | "inappropriate_content" */
  type: string;
  evidence?: Record<string, unknown>;
}

export interface RecordViolationResult {
  violationId: string;
  strikeCount: number;
  suspended: boolean;
}

export async function recordViolation({
  userId,
  postId = null,
  type,
  evidence = {},
}: RecordViolationInput): Promise<RecordViolationResult> {
  const admin = createAdminClient();

  const { data: violation, error: violationError } = await admin
    .from("violations")
    .insert({
      user_id: userId,
      post_id: postId,
      type,
      evidence,
      status: "confirmed",
    })
    .select("id")
    .single();
  if (violationError || !violation) {
    throw new Error(`recordViolation: insert failed: ${violationError?.message}`);
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("strike_count")
    .eq("id", userId)
    .single();
  const strikeCount = (profile?.strike_count ?? 0) + 1;
  const suspended = strikeCount >= STRIKES_BEFORE_SUSPENSION;

  const updates: Record<string, unknown> = { strike_count: strikeCount };
  let until: string | null = null;
  if (suspended) {
    until = new Date(Date.now() + STRIKE_SUSPENSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    updates.is_suspended = true;
    updates.suspended_until = until;
  }
  const { error: updateError } = await admin.from("profiles").update(updates).eq("id", userId);
  if (updateError) throw new Error(`recordViolation: strike update failed: ${updateError.message}`);

  if (suspended) {
    await notify(admin, userId, "suspended", {
      violationId: violation.id,
      strikeCount,
      until,
      days: STRIKE_SUSPENSION_DAYS,
    });
  } else {
    await notify(admin, userId, "strike_warning", {
      violationId: violation.id,
      strikeCount,
      remaining: STRIKES_BEFORE_SUSPENSION - strikeCount,
    });
  }

  return { violationId: violation.id, strikeCount, suspended };
}

/**
 * File an appeal against one of the caller's own CONFIRMED violations.
 * Throws on: violation not found / not theirs / not confirmed / an open
 * appeal already exists for it.
 */
export async function fileAppeal(
  violationId: string,
  userId: string,
  message: string
): Promise<{ appealId: string }> {
  const admin = createAdminClient();

  const { data: violation } = await admin
    .from("violations")
    .select("id, user_id, status")
    .eq("id", violationId)
    .single();
  if (!violation || violation.user_id !== userId) {
    throw new Error("Violation not found");
  }
  if (violation.status !== "confirmed") {
    throw new Error("Only confirmed violations can be appealed");
  }

  const { data: existing } = await admin
    .from("appeals")
    .select("id")
    .eq("violation_id", violationId)
    .eq("status", "open")
    .maybeSingle();
  if (existing) throw new Error("An appeal is already open for this violation");

  const { data: appeal, error } = await admin
    .from("appeals")
    .insert({ violation_id: violationId, user_id: userId, message, status: "open" })
    .select("id")
    .single();
  if (error || !appeal) throw new Error(`fileAppeal: insert failed: ${error?.message}`);
  return { appealId: appeal.id };
}

export interface DecideAppealResult {
  appealId: string;
  overturned: boolean;
}

/**
 * Admin decision on an appeal. Overturning marks the violation
 * 'overturned', removes the strike, and lifts the suspension IF the
 * account is currently suspended (a manual admin suspension set with a
 * custom reason is left alone only when suspended_until is null — in
 * practice strike-3 suspensions always set it, so this clears them).
 */
export async function decideAppeal(
  appealId: string,
  adminId: string,
  overturn: boolean
): Promise<DecideAppealResult> {
  const admin = createAdminClient();

  const { data: appeal } = await admin
    .from("appeals")
    .select("id, violation_id, user_id, status")
    .eq("id", appealId)
    .single();
  if (!appeal) throw new Error("Appeal not found");
  if (appeal.status !== "open") throw new Error("Appeal is already decided");

  const now = new Date().toISOString();
  const { error: appealError } = await admin
    .from("appeals")
    .update({
      status: overturn ? "overturned" : "upheld",
      decided_by: adminId,
      decided_at: now,
    })
    .eq("id", appeal.id);
  if (appealError) throw new Error(`decideAppeal: ${appealError.message}`);

  if (overturn) {
    await admin
      .from("violations")
      .update({ status: "overturned" })
      .eq("id", appeal.violation_id);

    const { data: profile } = await admin
      .from("profiles")
      .select("strike_count, is_suspended, suspended_until")
      .eq("id", appeal.user_id)
      .single();
    const updates: Record<string, unknown> = {
      strike_count: Math.max(0, (profile?.strike_count ?? 1) - 1),
    };
    // Lift the suspension if it is a strike-driven one (has an expiry).
    if (profile?.is_suspended && profile?.suspended_until) {
      updates.is_suspended = false;
      updates.suspended_until = null;
    }
    await admin.from("profiles").update(updates).eq("id", appeal.user_id);

    await notify(admin, appeal.user_id, "appeal_overturned", {
      appealId: appeal.id,
      violationId: appeal.violation_id,
    });
  } else {
    await notify(admin, appeal.user_id, "appeal_rejected", {
      appealId: appeal.id,
      violationId: appeal.violation_id,
    });
  }

  return { appealId: appeal.id, overturned: overturn };
}
