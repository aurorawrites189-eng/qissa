/**
 * GET /[lang]/api/search?q=&language=&type=posts|authors&page=&limit=
 *
 * Posts: trigram similarity over title/content via the public.search_posts()
 * SQL function (migration 0002). RLS inside the function restricts results
 * to posts the caller may view (kids only see kids-approved stories), and
 * the function excludes authors the caller has blocked.
 * Authors: public_profiles ilike on username/display_name, blocked authors
 * excluded in code.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getViewer, jsonError, parsePageParam } from "@/lib/api-helpers";

export const runtime = "edge";

const querySchema = z.object({
  q: z.string().trim().min(2, "Search for at least 2 characters").max(120),
  language: z.enum(["en", "ur"]).optional(),
  type: z.enum(["posts", "authors"]).default("posts"),
});

export async function GET(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer.userId) return jsonError("Sign in required", 401);

  const params = new URL(req.url).searchParams;
  const parsed = querySchema.safeParse({
    q: params.get("q") ?? "",
    language: params.get("language") ?? undefined,
    type: params.get("type") ?? "posts",
  });
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid input");
  const { q, language, type } = parsed.data;

  const page = parsePageParam(params.get("page"), 1, 100);
  const limit = parsePageParam(params.get("limit"), 20, 50);
  const offset = (page - 1) * limit;

  if (type === "authors") {
    const like = `%${q}%`;
    let query = viewer.supabase
      .from("public_profiles")
      .select("id, username, display_name, avatar_url, bio")
      .or(`username.ilike.${like},display_name.ilike.${like}`)
      .limit(limit)
      .range(offset, offset + limit - 1);
    const { data, error } = await query;
    if (error) return jsonError("Search failed", 500);

    // Exclude authors the viewer blocked.
    const { data: blocks } = await viewer.supabase.from("blocks").select("blocked_id");
    const blocked = new Set((blocks ?? []).map((b) => b.blocked_id));
    const authors = (data ?? []).filter((a) => !blocked.has(a.id));
    return NextResponse.json({ type, authors, page, limit });
  }

  // Posts via trigram similarity RPC (visibility + block exclusion in SQL).
  const { data, error } = await viewer.supabase.rpc("search_posts", {
    query_text: q,
    lang_filter: language ?? null,
    result_limit: limit,
    result_offset: offset,
  });
  if (error) return jsonError("Search failed", 500);

  const authorIds = [...new Set(((data ?? []) as Array<{ author_id: string }>).map((p) => p.author_id))];
  const { data: authors } = authorIds.length
    ? await viewer.supabase.from("public_profiles").select("id, username, display_name, avatar_url").in("id", authorIds)
    : { data: [] };
  const authorMap = new Map((authors ?? []).map((a) => [a.id, a]));

  return NextResponse.json({
    type,
    posts: ((data ?? []) as Array<{ author_id: string } & Record<string, unknown>>).map((p) => ({
      ...p,
      author: authorMap.get(p.author_id) ?? null,
    })),
    page,
    limit,
  });
}
