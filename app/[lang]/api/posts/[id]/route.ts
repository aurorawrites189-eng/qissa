import { createClient } from "@/lib/supabase/server";
import { postSchema, postUpdateSchema } from "@/lib/validation";
import { json, clientIp, rateLimitOr429, requireAdult, requireUser } from "@/lib/api/respond";

type Ctx = { params: { lang: string; id: string } };

/**
 * GET /[lang]/api/posts/[id] — single post. Visibility is enforced by RLS
 * (public.can_view_post): anonymous/adult readers see published public
 * posts, authors see their own drafts, children see kids-approved only.
 */
export async function GET(_request: Request, { params }: Ctx) {
  const supabase = createClient();
  const { data: post, error } = await supabase
    .from("posts")
    .select(
      "id, title, content, language, category, tags, status, visibility, published_at, view_count, author_id, post_images(storage_path, alt_text, caption)"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (error || !post) return json({ error: "not_found" }, 404);

  const { data: author } = await supabase
    .from("public_profiles")
    .select("id, username, display_name, avatar_url, bio")
    .eq("id", post.author_id as string)
    .maybeSingle();

  return json({ post, author: author ?? null });
}

async function ownPost(supabase: ReturnType<typeof createClient>, id: string, userId: string) {
  const { data } = await supabase
    .from("posts")
    .select("id, author_id, title, content, language, category, tags, status")
    .eq("id", id)
    .eq("author_id", userId)
    .maybeSingle();
  return data;
}

/**
 * Best-effort originality check. Phase 3 provides
 * POST /api/internal/originality-check { postId } — it may not exist yet
 * (a parallel agent is building it). Any failure (network, 404, 500) is
 * swallowed: the post simply stays in pending_review and moderators /
 * the Phase-3 job can run the check later.
 */
async function triggerOriginalityCheck(request: Request, postId: string): Promise<void> {
  try {
    const url = new URL("/api/internal/originality-check", request.url);
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postId }),
      // Never let a slow/missing endpoint hold the publish response.
      signal: AbortSignal.timeout(5000),
    });
    // Drain the body so the connection can be reused; ignore the outcome.
    await res.text().catch(() => {});
  } catch {
    // Endpoint missing or unreachable — post remains pending_review.
  }
}

/**
 * PATCH /[lang]/api/posts/[id] — update your own post (autosave drafts,
 * edit content). With { action: "publish" } the post is fully validated and
 * moved to pending_review, and the originality check is triggered
 * best-effort. Adult accounts only.
 */
export async function PATCH(request: Request, { params }: Ctx) {
  const limited = rateLimitOr429(`posts:update:${clientIp()}`, 30, 60_000);
  if (limited) return limited;

  const auth = await requireAdult();
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const parsed = postUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "invalid_post", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const supabase = createClient();
  const post = await ownPost(supabase, params.id, auth.ctx.user.id);
  if (!post) return json({ error: "not_found" }, 404);

  const { action, submit_as_kids, cover_image, visibility, ...fields } = parsed.data;

  if (action === "publish") {
    // Validate the FULL merged post — a draft may have been autosaved with
    // placeholder content.
    const merged = {
      title: fields.title ?? (post.title as string),
      content: fields.content ?? (post.content as string),
      language: fields.language ?? (post.language as string),
      category: fields.category ?? (post.category as string | null) ?? undefined,
      tags: fields.tags ?? (post.tags as string[]),
    };
    const full = postSchema.safeParse(merged);
    if (!full.success) {
      return json({ error: "invalid_post", details: full.error.flatten().fieldErrors }, 400);
    }

    if (submit_as_kids) {
      // "Submit as kids' story" is only meaningful with a kids' category.
      const { data: cat } = await supabase
        .from("categories")
        .select("is_kids")
        .eq("slug", full.data.category ?? "")
        .maybeSingle();
      if (!cat?.is_kids) {
        return json({ error: "kids_category_required" }, 400);
      }
    }

    const updatePayload: Record<string, unknown> = {
      ...full.data,
      category: full.data.category ?? null,
      status: "pending_review",
      moderation_status: "unreviewed",
      originality_status: "unchecked",
      originality_evidence: null,
      published_at: null,
      visibility: visibility ?? "public",
    };
    const { data: updated, error } = await supabase
      .from("posts")
      .update(updatePayload)
      .eq("id", params.id)
      .select("id, title, status, originality_status")
      .single();
    if (error) return json({ error: "publish_failed" }, 500);

    // Fire-and-forget: never let the check break the publish flow.
    await triggerOriginalityCheck(request, params.id);
    return json({ post: updated, originality_check: "triggered_best_effort" });
  }

  // Plain update (autosave / draft edit).
  const updatePayload: Record<string, unknown> = { ...fields };
  if (visibility) updatePayload.visibility = visibility;
  if (Object.keys(updatePayload).length === 0 && cover_image === undefined) {
    return json({ error: "nothing_to_update" }, 400);
  }
  if (Object.keys(updatePayload).length > 0) {
    const { error } = await supabase.from("posts").update(updatePayload).eq("id", params.id);
    if (error) return json({ error: "update_failed" }, 500);
  }

  // Cover image: keep exactly one cover row per post (replace on upload).
  if (cover_image !== undefined) {
    await supabase.from("post_images").delete().eq("post_id", params.id);
    if (cover_image) {
      const { error: imgError } = await supabase.from("post_images").insert({
        post_id: params.id,
        storage_path: cover_image.storage_path,
        alt_text: cover_image.alt_text ?? null,
        caption: null,
      });
      if (imgError) return json({ error: "cover_image_failed" }, 500);
    }
  }

  const { data: refreshed } = await supabase
    .from("posts")
    .select("id, title, content, language, category, tags, status, visibility, updated_at")
    .eq("id", params.id)
    .single();
  return json({ post: refreshed });
}

/**
 * DELETE /[lang]/api/posts/[id] — delete your own post. Adult accounts only.
 */
export async function DELETE(_request: Request, { params }: Ctx) {
  const limited = rateLimitOr429(`posts:delete:${clientIp()}`, 20, 60_000);
  if (limited) return limited;

  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  // Explicit child guard (middleware + RLS also deny this).
  if (auth.ctx.ageClass === "child") return json({ error: "forbidden_child_account" }, 403);

  const supabase = createClient();
  const post = await ownPost(supabase, params.id, auth.ctx.user.id);
  if (!post) return json({ error: "not_found" }, 404);

  const { error } = await supabase.from("posts").delete().eq("id", params.id);
  if (error) return json({ error: "delete_failed" }, 500);
  return json({ ok: true });
}
