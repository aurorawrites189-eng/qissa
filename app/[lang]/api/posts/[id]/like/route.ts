/**
 * /[lang]/api/posts/[id]/like
 *   POST   — like a story (adults only; explicit 403 for kids, on top of RLS)
 *   DELETE — unlike
 * Returns { liked, likeCount }. likeCount is read via the service role
 * because the likes RLS policy is owner-only.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  getViewer,
  requireAdult,
  isErrorResponse,
  jsonError,
  notFound,
  rateLimitWrite,
} from "@/lib/api-helpers";

export const runtime = "edge";

interface RouteParams {
  params: Promise<{ lang: string; id: string }>;
}

async function likeCount(postId: string): Promise<number> {
  const { count } = await createAdminClient()
    .from("likes")
    .select("post_id", { count: "exact", head: true })
    .eq("post_id", postId);
  return count ?? 0;
}

/** The post must be visible to the liker (RLS enforces can_view_post). */
async function visiblePost(ctx: { supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>> }, postId: string) {
  const { data } = await ctx.supabase.from("posts").select("id").eq("id", postId).maybeSingle();
  return data;
}

export async function POST(req: NextRequest, { params: _params }: RouteParams) {
  const params = await _params;
  const viewer = await getViewer();
  const ctx = requireAdult(viewer);
  if (isErrorResponse(ctx)) return ctx;

  const limited = rateLimitWrite(req, "like", ctx.userId, 30, 60_000);
  if (limited) return limited;

  if (!(await visiblePost(ctx, params.id))) return notFound("Story not found");

  const { error } = await ctx.supabase
    .from("likes")
    .upsert({ user_id: ctx.userId, post_id: params.id }, { onConflict: "user_id,post_id" });
  if (error) return jsonError("Could not like the story", 500);

  return NextResponse.json({ liked: true, likeCount: await likeCount(params.id) });
}

export async function DELETE(req: NextRequest, { params: _params }: RouteParams) {
  const params = await _params;
  const viewer = await getViewer();
  const ctx = requireAdult(viewer);
  if (isErrorResponse(ctx)) return ctx;

  const limited = rateLimitWrite(req, "like", ctx.userId, 30, 60_000);
  if (limited) return limited;

  const { error } = await ctx.supabase
    .from("likes")
    .delete()
    .eq("user_id", ctx.userId)
    .eq("post_id", params.id);
  if (error) return jsonError("Could not remove the like", 500);

  return NextResponse.json({ liked: false, likeCount: await likeCount(params.id) });
}
