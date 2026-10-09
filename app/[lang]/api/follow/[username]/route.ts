/**
 * /[lang]/api/follow/[username]
 *   POST   — follow an author (adults only; explicit 403 for kids + RLS)
 *   DELETE — unfollow
 * Self-follow is rejected (400). Following someone notifies them.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notifications";
import {
  getViewer,
  requireAdult,
  isErrorResponse,
  jsonError,
  notFound,
  rateLimitWrite,
} from "@/lib/api-helpers";

interface RouteParams {
  params: { lang: string; username: string };
}

async function resolveUser(username: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("public_profiles")
    .select("id, username")
    .eq("username", username.toLowerCase())
    .maybeSingle();
  return data;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const viewer = await getViewer();
  const ctx = requireAdult(viewer);
  if (isErrorResponse(ctx)) return ctx;

  const limited = rateLimitWrite(req, "follow", ctx.userId, 30, 60_000);
  if (limited) return limited;

  const target = await resolveUser(params.username);
  if (!target) return notFound("Author not found");
  if (target.id === ctx.userId) return jsonError("You cannot follow yourself", 400);

  const { error } = await ctx.supabase
    .from("follows")
    .upsert({ follower_id: ctx.userId, following_id: target.id }, { onConflict: "follower_id,following_id" });
  if (error) return jsonError("Could not follow", 500);

  await notify(createAdminClient(), target.id, "new_follower", {
    followerId: ctx.userId,
    followerUsername: ctx.profile!.username,
  });

  return NextResponse.json({ following: true, username: target.username });
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const viewer = await getViewer();
  const ctx = requireAdult(viewer);
  if (isErrorResponse(ctx)) return ctx;

  const limited = rateLimitWrite(req, "follow", ctx.userId, 30, 60_000);
  if (limited) return limited;

  const target = await resolveUser(params.username);
  if (!target) return notFound("Author not found");

  const { error } = await ctx.supabase
    .from("follows")
    .delete()
    .eq("follower_id", ctx.userId)
    .eq("following_id", target.id);
  if (error) return jsonError("Could not unfollow", 500);

  return NextResponse.json({ following: false, username: target.username });
}
