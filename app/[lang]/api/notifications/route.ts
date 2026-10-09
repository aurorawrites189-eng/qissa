/**
 * /[lang]/api/notifications
 *   GET   — the caller's notifications (newest first) + unreadCount.
 *   PATCH — mark as read. { ids: string[] } or { markAll: true }.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getViewer,
  requireUser,
  isErrorResponse,
  jsonError,
  rateLimitWrite,
  parsePageParam,
} from "@/lib/api-helpers";

const patchSchema = z
  .object({
    ids: z.array(z.string().uuid()).max(100).optional(),
    markAll: z.boolean().optional(),
  })
  .refine((v) => v.markAll || (v.ids && v.ids.length > 0), {
    message: "Provide ids or markAll",
  });

export async function GET(req: NextRequest) {
  const viewer = await getViewer();
  const ctx = requireUser(viewer);
  if (isErrorResponse(ctx)) return ctx;

  const limit = parsePageParam(new URL(req.url).searchParams.get("limit"), 30, 100);

  const { data: notifications, error } = await ctx.supabase
    .from("notifications")
    .select("id, type, payload, is_read, created_at")
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return jsonError("Could not load notifications", 500);

  const { count: unreadCount } = await ctx.supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ctx.userId)
    .eq("is_read", false);

  return NextResponse.json({ notifications: notifications ?? [], unreadCount: unreadCount ?? 0 });
}

export async function PATCH(req: NextRequest) {
  const viewer = await getViewer();
  const ctx = requireUser(viewer);
  if (isErrorResponse(ctx)) return ctx;

  const limited = rateLimitWrite(req, "notifications", ctx.userId, 30, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid input");

  let query = ctx.supabase.from("notifications").update({ is_read: true }).eq("user_id", ctx.userId);
  if (!parsed.data.markAll && parsed.data.ids) {
    query = query.in("id", parsed.data.ids);
  }
  const { error } = await query;
  if (error) return jsonError("Could not update notifications", 500);

  return NextResponse.json({ ok: true });
}
