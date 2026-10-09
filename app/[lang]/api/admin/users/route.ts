/**
 * /[lang]/api/admin/users  (admin only)
 *
 * GET  ?q=&limit= — list/search users (username or display name).
 * POST { action: "suspend"|"unsuspend"|"make_admin"|"remove_admin",
 *        userId, reason?, days? }
 *      suspend → is_suspended + suspended_until (days, default 30);
 *      unsuspend → clears both; make/remove_admin → is_admin flag.
 *      Every change writes a moderation_actions audit row and notifies the
 *      affected user. Admins cannot demote or suspend themselves.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notifications";
import { STRIKE_SUSPENSION_DAYS } from "@/lib/strikes";
import {
  getViewer,
  requireAdmin,
  isErrorResponse,
  jsonError,
  rateLimitWrite,
  parsePageParam,
} from "@/lib/api-helpers";

const actionSchema = z.object({
  action: z.enum(["suspend", "unsuspend", "make_admin", "remove_admin"]),
  userId: z.string().uuid("Invalid user id"),
  reason: z.string().trim().max(500).optional(),
  days: z.number().int().min(1).max(365).optional(),
});

const PUBLIC_USER_FIELDS =
  "id, username, display_name, age_class, is_admin, strike_count, is_suspended, suspended_until, created_at";

export async function GET(req: NextRequest) {
  const viewer = await getViewer();
  const ctx = requireAdmin(viewer);
  if (isErrorResponse(ctx)) return ctx;
  const admin = createAdminClient();

  const params = new URL(req.url).searchParams;
  const q = (params.get("q") ?? "").trim();
  const limit = parsePageParam(params.get("limit"), 50, 100);

  let query = admin.from("profiles").select(PUBLIC_USER_FIELDS).order("created_at", { ascending: false }).limit(limit);
  if (q) {
    const like = `%${q}%`;
    query = query.or(`username.ilike.${like},display_name.ilike.${like}`);
  }
  const { data, error } = await query;
  if (error) return jsonError("Could not list users", 500);
  return NextResponse.json({ users: data ?? [] });
}

export async function POST(req: NextRequest) {
  const viewer = await getViewer();
  const ctx = requireAdmin(viewer);
  if (isErrorResponse(ctx)) return ctx;

  const limited = rateLimitWrite(req, "admin-users", ctx.userId, 60, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid input");
  const { action, userId, reason, days } = parsed.data;

  if (userId === ctx.userId && (action === "remove_admin" || action === "suspend")) {
    return jsonError("You cannot change your own admin/suspension status", 400);
  }

  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("id, username").eq("id", userId).single();
  if (!target) return jsonError("User not found", 404);

  let updates: Record<string, unknown> = {};
  if (action === "suspend") {
    const suspensionDays = days ?? STRIKE_SUSPENSION_DAYS;
    updates = {
      is_suspended: true,
      suspended_until: new Date(Date.now() + suspensionDays * 24 * 60 * 60 * 1000).toISOString(),
    };
    await notify(admin, userId, "suspended", { reason: reason ?? null, days: suspensionDays, manual: true });
  } else if (action === "unsuspend") {
    updates = { is_suspended: false, suspended_until: null };
    await notify(admin, userId, "unsuspended", { reason: reason ?? null });
  } else if (action === "make_admin") {
    updates = { is_admin: true };
  } else {
    updates = { is_admin: false };
  }

  const { error } = await admin.from("profiles").update(updates).eq("id", userId);
  if (error) return jsonError("Could not update the user", 500);

  await admin.from("moderation_actions").insert({
    admin_id: ctx.userId,
    target_type: "user",
    target_id: userId,
    action,
    reason: reason ?? null,
  });

  return NextResponse.json({ ok: true, userId, action });
}
