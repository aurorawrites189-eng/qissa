/**
 * /[lang]/api/reports
 *   POST — file a report against a post. ANY authenticated user, INCLUDING
 *          children: kids must be able to report stories in the kids section.
 *   GET  — the caller's own reports (with the reported post's title).
 */
import { NextRequest, NextResponse } from "next/server";
import { reportSchema } from "@/lib/validation";
import { createAdminClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notifications";
import {
  getViewer,
  requireUser,
  isErrorResponse,
  jsonError,
  rateLimitWrite,
} from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  const viewer = await getViewer();
  const ctx = requireUser(viewer);
  if (isErrorResponse(ctx)) return ctx;

  const limited = rateLimitWrite(req, "reports", ctx.userId, 10, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }
  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid input");

  // The post must be visible to the reporter (RLS enforces can_view_post).
  const { data: post } = await ctx.supabase
    .from("posts")
    .select("id")
    .eq("id", parsed.data.post_id)
    .maybeSingle();
  if (!post) return jsonError("Story not found", 404);

  const { data: report, error } = await ctx.supabase
    .from("reports")
    .insert({
      reporter_id: ctx.userId,
      post_id: parsed.data.post_id,
      reason: parsed.data.reason,
      details: parsed.data.details ?? null,
      status: "open",
    })
    .select("id")
    .single();
  if (error || !report) {
    return jsonError("Could not submit the report", 500);
  }

  // Best-effort: let the reporter know we received it.
  await notify(createAdminClient(), ctx.userId!, "report_received", {
    reportId: report.id,
    postId: parsed.data.post_id,
  });

  return NextResponse.json({ ok: true, reportId: report.id }, { status: 201 });
}

export async function GET() {
  const viewer = await getViewer();
  const ctx = requireUser(viewer);
  if (isErrorResponse(ctx)) return ctx;

  const { data: reports } = await ctx.supabase
    .from("reports")
    .select("id, post_id, reason, details, status, created_at, posts ( title )")
    .eq("reporter_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ reports: reports ?? [] });
}
