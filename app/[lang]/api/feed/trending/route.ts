/**
 * GET /[lang]/api/feed/trending?page=&limit=
 *
 * Trending stories: published in the last 30 days, ranked by
 *   score = view_count + like_count * 10
 * (likes weigh 10× a view — an explicit editorial choice documented here).
 * Posts are read through the caller's RLS (kids only see kids-approved),
 * like counts via the service role, and authors the caller blocked are
 * excluded.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getViewer, jsonError, parsePageParam } from "@/lib/api-helpers";
import { LIKE_WEIGHT, TRENDING_WINDOW_DAYS } from "@/lib/trending";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer.userId) return jsonError("Sign in required", 401);

  const params = new URL(req.url).searchParams;
  const page = parsePageParam(params.get("page"), 1, 50);
  const limit = parsePageParam(params.get("limit"), 20, 50);

  const since = new Date(Date.now() - TRENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // RLS applies: only posts this viewer may see.
  const { data: posts, error } = await viewer.supabase
    .from("posts")
    .select("id, author_id, title, language, category, tags, published_at, view_count")
    .eq("status", "published")
    .eq("visibility", "public")
    .gte("published_at", since)
    .order("published_at", { ascending: false })
    .limit(200);
  if (error) return jsonError("Could not load trending stories", 500);

  const ids = (posts ?? []).map((p) => p.id);
  let likeCounts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: likes } = await createAdminClient().from("likes").select("post_id").in("post_id", ids);
    likeCounts = new Map<string, number>();
    for (const l of likes ?? []) {
      likeCounts.set(l.post_id, (likeCounts.get(l.post_id) ?? 0) + 1);
    }
  }

  // Exclude authors the viewer blocked.
  const { data: blocks } = await viewer.supabase.from("blocks").select("blocked_id");
  const blocked = new Set((blocks ?? []).map((b) => b.blocked_id));

  const ranked = (posts ?? [])
    .filter((p) => !blocked.has(p.author_id))
    .map((p) => {
      const likeCount = likeCounts.get(p.id) ?? 0;
      return { ...p, likeCount, trendingScore: (p.view_count ?? 0) + likeCount * LIKE_WEIGHT };
    })
    .sort((a, b) => b.trendingScore - a.trendingScore);

  const slice = ranked.slice((page - 1) * limit, page * limit);
  const authorIds = [...new Set(slice.map((p) => p.author_id))];
  const { data: authors } = authorIds.length
    ? await viewer.supabase.from("public_profiles").select("id, username, display_name, avatar_url").in("id", authorIds)
    : { data: [] };
  const authorMap = new Map((authors ?? []).map((a) => [a.id, a]));

  return NextResponse.json({
    posts: slice.map((p) => ({ ...p, author: authorMap.get(p.author_id) ?? null })),
    page,
    limit,
    total: ranked.length,
  });
}
