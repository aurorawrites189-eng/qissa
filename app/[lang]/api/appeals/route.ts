/**
 * /[lang]/api/appeals
 *   POST  — file an appeal against one of the caller's own confirmed
 *           violations. { violation_id, message }
 *   PATCH — admin decides an appeal. { appeal_id, overturn: boolean }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fileAppeal, decideAppeal } from "@/lib/strikes";
import { createAdminClient } from "@/lib/supabase/server";
import {
  getViewer,
  requireUser,
  requireAdmin,
  isErrorResponse,
  jsonError,
  rateLimitWrite,
} from "@/lib/api-helpers";

const fileSchema = z.object({
  violation_id: z.string().uuid("Invalid violation id"),
  message: z.string().trim().min(10, "Please explain in at least 10 characters").max(2000, "Message is too long"),
});

const decideSchema = z.object({
  appeal_id: z.string().uuid("Invalid appeal id"),
  overturn: z.boolean(),
});

export async function POST(req: NextRequest) {
  const viewer = await getViewer();
  const ctx = requireUser(viewer);
  if (isErrorResponse(ctx)) return ctx;

  const limited = rateLimitWrite(req, "appeals", ctx.userId, 10, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }
  const parsed = fileSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid input");

  try {
    const { appealId } = await fileAppeal(parsed.data.violation_id, ctx.userId!, parsed.data.message);
    return NextResponse.json({ ok: true, appealId }, { status: 201 });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Could not file appeal", 400);
  }
}

export async function PATCH(req: NextRequest) {
  const viewer = await getViewer();
  const ctx = requireAdmin(viewer);
  if (isErrorResponse(ctx)) return ctx;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }
  const parsed = decideSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid input");

  try {
    const result = await decideAppeal(parsed.data.appeal_id, ctx.userId!, parsed.data.overturn);
    // Audit trail.
    await createAdminClient().from("moderation_actions").insert({
      admin_id: ctx.userId,
      target_type: "appeal",
      target_id: parsed.data.appeal_id,
      action: parsed.data.overturn ? "appeal_overturned" : "appeal_upheld",
      reason: null,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Could not decide appeal", 400);
  }
}
