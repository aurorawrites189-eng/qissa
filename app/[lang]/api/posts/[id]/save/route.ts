/**
 * /[lang]/api/posts/[id]/save
 *   POST   — save a story to the caller's library
 *   DELETE — remove it
 * Saving is read-side personalization, so kids accounts MAY save stories
 * (their RLS policy allows it); no adult check here.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getViewer,
  requireUser,
  isErrorResponse,
  jsonError,
  notFound,
  rateLimitWrite,
} from "@/lib/api-helpers";

export const runtime = "edge";

interface RouteParams {
  params: Promise<{ lang: string; id: string }>;
}

export async function POST(req: NextRequest, { params: _params }: RouteParams) {
  const params = await _params;
  const viewer = await getViewer();
  const ctx = requireUser(viewer);
  if (isErrorResponse(ctx)) return ctx;

  const limited = rateLimitWrite(req, "save", ctx.userId, 30, 60_000);
  if (limited) return limited;

  const { data: post } = await ctx.supabase.from("posts").select("id").eq("id", params.id).maybeSingle();
  if (!post) return notFound("Story not found");

  const { error } = await ctx.supabase
    .from("saved_posts")
    .upsert({ user_id: ctx.userId, post_id: params.id }, { onConflict: "user_id,post_id" });
  if (error) return jsonError("Could not save the story", 500);

  return NextResponse.json({ saved: true });
}

export async function DELETE(req: NextRequest, { params: _params }: RouteParams) {
  const params = await _params;
  const viewer = await getViewer();
  const ctx = requireUser(viewer);
  if (isErrorResponse(ctx)) return ctx;

  const limited = rateLimitWrite(req, "save", ctx.userId, 30, 60_000);
  if (limited) return limited;

  const { error } = await ctx.supabase
    .from("saved_posts")
    .delete()
    .eq("user_id", ctx.userId)
    .eq("post_id", params.id);
  if (error) return jsonError("Could not remove the saved story", 500);

  return NextResponse.json({ saved: false });
}
