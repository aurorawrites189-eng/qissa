/**
 * /[lang]/api/posts/[id]/comments
 *   GET  — visible comments with authors (via the public_profiles view).
 *          Anyone who can view the post can read its comments.
 *   POST — add a comment. ADULTS ONLY: explicit 403 for kids, on top of the
 *          RLS policy that also blocks child writes. Notifies the author.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notifications";
import {
  getViewer,
  requireUser,
  requireAdult,
  isErrorResponse,
  jsonError,
  notFound,
  rateLimitWrite,
  parsePageParam,
} from "@/lib/api-helpers";

export const runtime = "edge";

interface RouteParams {
  params: Promise<{ lang: string; id: string }>;
}

const commentBodySchema = z.object({
  content: z.string().trim().min(1, "Comment cannot be empty").max(2000, "Comment is too long"),
});

export async function GET(req: NextRequest, { params: _params }: RouteParams) {
  const params = await _params;
  const viewer = await getViewer();
  if (!viewer.userId) return jsonError("Sign in required", 401);

  const limit = parsePageParam(new URL(req.url).searchParams.get("limit"), 50, 100);

  // RLS filters to posts the viewer may see.
  const { data: post } = await viewer.supabase
    .from("posts")
    .select("id")
    .eq("id", params.id)
    .maybeSingle();
  if (!post) return notFound("Story not found");

  const { data: comments, error } = await viewer.supabase
    .from("comments")
    .select("id, content, created_at, author_id")
    .eq("post_id", params.id)
    .eq("status", "visible")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) return jsonError("Could not load comments", 500);

  // Author details via the public view (no FK from comments → view exists).
  const authorIds = [...new Set((comments ?? []).map((c) => c.author_id))];
  const { data: authors } = authorIds.length
    ? await viewer.supabase.from("public_profiles").select("id, username, display_name, avatar_url").in("id", authorIds)
    : { data: [] };
  const authorMap = new Map((authors ?? []).map((a) => [a.id, a]));

  return NextResponse.json({
    comments: (comments ?? []).map((c) => ({
      id: c.id,
      content: c.content,
      created_at: c.created_at,
      author: authorMap.get(c.author_id) ?? null,
    })),
  });
}

export async function POST(req: NextRequest, { params: _params }: RouteParams) {
  const params = await _params;
  const viewer = await getViewer();
  const ctx = requireAdult(viewer);
  if (isErrorResponse(ctx)) return ctx;

  const limited = rateLimitWrite(req, "comments", ctx.userId, 20, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }
  const parsed = commentBodySchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid input");

  const { data: post } = await ctx.supabase
    .from("posts")
    .select("id, author_id, title")
    .eq("id", params.id)
    .maybeSingle();
  if (!post) return notFound("Story not found");

  const { data: comment, error } = await ctx.supabase
    .from("comments")
    .insert({ post_id: params.id, author_id: ctx.userId, content: parsed.data.content })
    .select("id, content, created_at")
    .single();
  if (error || !comment) return jsonError("Could not post the comment", 500);

  if (post.author_id !== ctx.userId) {
    await notify(createAdminClient(), post.author_id, "new_comment", {
      postId: post.id,
      title: post.title,
      commentId: comment.id,
      commenterUsername: ctx.profile!.username,
    });
  }

  return NextResponse.json({ ok: true, comment }, { status: 201 });
}
