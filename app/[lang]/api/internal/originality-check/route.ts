/**
 * POST /[lang]/api/internal/originality-check  { postId: string }
 *
 * Runs the internal originality check (lib/originality). Called best-effort
 * by Phase 2's publish flow after a post enters pending_review.
 *
 * PRODUCTION WARNING: this runs synchronously inside the request (it can
 * take seconds on a large corpus). Production should instead enqueue the
 * postId (pg-boss / Supabase Queues / a cron worker) and have the worker
 * call runOriginalityCheck() directly. Set INTERNAL_API_SECRET in
 * production: when set, this route requires it as the `x-internal-secret`
 * header so random clients cannot burn CPU on your database.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runOriginalityCheck } from "@/lib/originality";
import { jsonError, rateLimitWrite, getClientIp } from "@/lib/api-helpers";

const bodySchema = z.object({
  postId: z.string().uuid("Invalid post id"),
});

export async function POST(req: NextRequest) {
  const secret = process.env.INTERNAL_API_SECRET;
  if (secret) {
    const provided = req.headers.get("x-internal-secret");
    if (provided !== secret) return jsonError("Forbidden", 403);
  }

  const limited = rateLimitWrite(req, "originality-check", getClientIp(req), 30, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid input");

  try {
    const result = await runOriginalityCheck(parsed.data.postId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[originality-check] failed:", err);
    return jsonError(err instanceof Error ? err.message : "Check failed", 500);
  }
}
