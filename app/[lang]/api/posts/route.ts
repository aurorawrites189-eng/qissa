import { createClient } from "@/lib/supabase/server";
import { postSchema, postsQuerySchema } from "@/lib/validation";
import { json, clientIp, rateLimitOr429, requireAdult } from "@/lib/api/respond";

/**
 * GET /[lang]/api/posts?lang=&category=&q=&page=&limit=
 * Public story feed: only published + public posts. RLS further restricts
 * what a signed-in CHILD session can see (kids-approved only) via
 * public.can_view_post().
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = postsQuerySchema.safeParse({
    lang: url.searchParams.get("lang") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return json({ error: "invalid_query", details: parsed.error.flatten().fieldErrors }, 400);
  }
  const { lang, category, q, page, limit } = parsed.data;

  const supabase = createClient();
  let query = supabase
    .from("posts")
    .select(
      "id, title, content, language, category, tags, published_at, view_count, author_id, post_images(storage_path, alt_text)",
      { count: "exact" }
    )
    .eq("status", "published")
    .eq("visibility", "public")
    .order("published_at", { ascending: false });

  if (lang) query = query.eq("language", lang);
  if (category) query = query.eq("category", category);
  if (q) {
    // Strip LIKE wildcards AND postgrest filter-syntax chars (commas/parens
    // would break the .or() expression) before interpolating.
    const term = q.replace(/[%_(),]/g, "").trim();
    if (term) query = query.or(`title.ilike.%${term}%,content.ilike.%${term}%`);
  }

  const from = (page - 1) * limit;
  const { data, count, error } = await query.range(from, from + limit - 1);
  if (error) return json({ error: "query_failed" }, 500);

  // Public author info comes from the SECURITY DEFINER view (never profiles).
  const authorIds = [...new Set((data ?? []).map((p) => p.author_id as string))];
  let authors: Record<string, { username: string; display_name: string | null; avatar_url: string | null }> = {};
  if (authorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("public_profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", authorIds);
    for (const p of profiles ?? []) {
      authors[p.id as string] = {
        username: p.username as string,
        display_name: (p.display_name as string | null) ?? null,
        avatar_url: (p.avatar_url as string | null) ?? null,
      };
    }
  }

  const posts = (data ?? []).map((p) => ({
    ...p,
    excerpt: (p.content as string).slice(0, 240),
    content: undefined,
    author: authors[p.author_id as string] ?? null,
  }));

  const total = count ?? 0;
  return json({
    posts,
    page,
    limit,
    total,
    total_pages: Math.max(1, Math.ceil(total / limit)),
  });
}

/**
 * POST /[lang]/api/posts — create a new draft. Adult accounts only
 * (children get an explicit 403; RLS would deny the insert anyway).
 */
export async function POST(request: Request) {
  const limited = rateLimitOr429(`posts:create:${clientIp()}`, 20, 60_000);
  if (limited) return limited;

  const auth = await requireAdult();
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  // Drafts may be incomplete — validate only the fields that are present.
  const parsed = postSchema.partial().safeParse(body);
  if (!parsed.success) {
    return json({ error: "invalid_post", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("posts")
    .insert({
      author_id: auth.ctx.user.id,
      title: parsed.data.title?.trim() || "Untitled",
      content: parsed.data.content ?? "",
      language: parsed.data.language ?? "en",
      category: parsed.data.category?.trim() || null,
      tags: parsed.data.tags ?? [],
      status: "draft",
    })
    .select("id, title, content, language, category, tags, status, created_at, updated_at")
    .single();

  if (error) return json({ error: "create_failed" }, 500);
  return json({ post: data }, 201);
}
