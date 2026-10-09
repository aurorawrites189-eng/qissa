/**
 * /[lang]/api/admin/moderation  (admin only)
 *
 * GET ?queue=posts|reports|kids|originality
 *   posts       — stories with status pending_review
 *   reports     — open reports (with reporter + post)
 *   kids        — published stories in kids categories awaiting
 *                 is_kids_approved (Phase 2 convention: posts.category
 *                 holds the category slug; kids categories have is_kids)
 *   originality — posts flagged possible_duplication / strong_evidence
 *
 * POST { action, targetType, targetId, reason? }
 *   targetType "post":  approve → published (+published_at if unset)
 *                       reject | withhold → withheld
 *                       approve_kids → is_kids_approved=true + published
 *   targetType "report": dismiss | uphold → report resolved/dismissed
 *   Every decision writes a moderation_actions audit row and notifies the
 *   affected author.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notifications";
import { getModerationQueue, type ModerationQueue } from "@/lib/admin-queries";
import {
  getViewer,
  requireAdmin,
  isErrorResponse,
  jsonError,
  rateLimitWrite,
} from "@/lib/api-helpers";

const actionSchema = z.object({
  action: z.enum(["approve", "reject", "withhold", "approve_kids", "dismiss", "uphold"]),
  targetType: z.enum(["post", "report"]),
  targetId: z.string().uuid("Invalid target id"),
  reason: z.string().trim().max(500).optional(),
});

const QUEUES: ModerationQueue[] = ["posts", "reports", "kids", "originality"];

export async function GET(req: NextRequest) {
  const viewer = await getViewer();
  const ctx = requireAdmin(viewer);
  if (isErrorResponse(ctx)) return ctx;

  const queueParam = new URL(req.url).searchParams.get("queue") ?? "posts";
  if (!(QUEUES as string[]).includes(queueParam)) {
    return jsonError("Unknown queue. Use posts|reports|kids|originality");
  }
  const items = await getModerationQueue(createAdminClient(), queueParam as ModerationQueue);
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const viewer = await getViewer();
  const ctx = requireAdmin(viewer);
  if (isErrorResponse(ctx)) return ctx;

  const limited = rateLimitWrite(req, "admin-moderation", ctx.userId, 60, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid input");
  const { action, targetType, targetId, reason } = parsed.data;

  const admin = createAdminClient();
  const now = new Date().toISOString();

  if (targetType === "post") {
    if (!["approve", "reject", "withhold", "approve_kids"].includes(action)) {
      return jsonError("Invalid action for a post");
    }
    const { data: post } = await admin
      .from("posts")
      .select("id, author_id, title, status, published_at")
      .eq("id", targetId)
      .single();
    if (!post) return jsonError("Story not found", 404);

    let updates: Record<string, unknown> = {};
    let notifyType: "moderation_approved" | "moderation_rejected" | "kids_approved" = "moderation_approved";
    let auditAction = action;

    if (action === "approve" || action === "approve_kids") {
      updates = {
        status: "published",
        published_at: post.published_at ?? now,
        ...(action === "approve_kids" ? { is_kids_approved: true } : {}),
      };
      notifyType = action === "approve_kids" ? "kids_approved" : "moderation_approved";
    } else {
      updates = { status: "withheld" };
      notifyType = "moderation_rejected";
    }

    const { error } = await admin.from("posts").update(updates).eq("id", post.id);
    if (error) return jsonError("Could not update the story", 500);

    await admin.from("moderation_actions").insert({
      admin_id: ctx.userId,
      target_type: "post",
      target_id: post.id,
      action: auditAction,
      reason: reason ?? null,
    });
    await notify(admin, post.author_id, notifyType, {
      postId: post.id,
      title: post.title,
      reason: reason ?? null,
    });
    return NextResponse.json({ ok: true, postId: post.id, status: updates.status });
  }

  // targetType === "report"
  if (!["dismiss", "uphold"].includes(action)) {
    return jsonError("Invalid action for a report");
  }
  const { data: report } = await admin
    .from("reports")
    .select("id, reporter_id, post_id, status")
    .eq("id", targetId)
    .single();
  if (!report) return jsonError("Report not found", 404);
  if (report.status !== "open") return jsonError("Report is already decided");

  const { error } = await admin
    .from("reports")
    .update({
      status: action === "uphold" ? "resolved" : "dismissed",
      decided_by: ctx.userId,
      decided_at: now,
    })
    .eq("id", report.id);
  if (error) return jsonError("Could not resolve the report", 500);

  await admin.from("moderation_actions").insert({
    admin_id: ctx.userId,
    target_type: "report",
    target_id: report.id,
    action: action === "uphold" ? "report_upheld" : "report_dismissed",
    reason: reason ?? null,
  });
  return NextResponse.json({ ok: true, reportId: report.id, status: action });
}
