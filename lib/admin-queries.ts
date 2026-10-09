/**
 * Shared admin queue queries — used by both the /api/admin/moderation
 * route and the server-rendered admin pages so the queue definitions
 * live in exactly one place.
 */
import { createAdminClient } from "./supabase/server";

type AdminClient = ReturnType<typeof createAdminClient>;

export type ModerationQueue = "posts" | "reports" | "kids" | "originality";

export interface QueueAuthor {
  username: string;
  display_name: string | null;
}

export interface QueueItem {
  id: string;
  title?: string;
  author?: QueueAuthor | null;
  reporter?: QueueAuthor | null;
  post?: { id: string; title: string } | null;
  reason?: string;
  details?: string | null;
  post_id?: string | null;
  created_at?: string;
  originality_status?: string;
  originality_evidence?: {
    score?: number;
    corpusSize?: number;
    matches?: Array<{ postId: string; title: string; score: number; exactMatches: string[] }>;
  } | null;
}

async function authorMap(admin: AdminClient, authorIds: Array<string | null>) {
  const unique = [...new Set(authorIds.filter((x): x is string => !!x))];
  if (unique.length === 0) return new Map<string, QueueAuthor>();
  const { data } = await admin.from("public_profiles").select("id, username, display_name").in("id", unique);
  return new Map((data ?? []).map((p) => [p.id as string, { username: p.username as string, display_name: p.display_name as string | null }]));
}

export async function getModerationQueue(admin: AdminClient, queue: ModerationQueue): Promise<QueueItem[]> {
  if (queue === "posts") {
    const { data } = await admin
      .from("posts")
      .select("id, author_id, title, language, category, status, created_at")
      .eq("status", "pending_review")
      .order("created_at", { ascending: true })
      .limit(100);
    const authors = await authorMap(admin, (data ?? []).map((p) => p.author_id));
    return (data ?? []).map((p) => ({ ...p, author: authors.get(p.author_id) ?? null }));
  }

  if (queue === "reports") {
    const { data } = await admin
      .from("reports")
      .select("id, reporter_id, post_id, reason, details, status, created_at")
      .eq("status", "open")
      .order("created_at", { ascending: true })
      .limit(100);
    const reporters = await authorMap(admin, (data ?? []).map((r) => r.reporter_id));
    const postIds = [...new Set((data ?? []).map((r) => r.post_id).filter((x): x is string => !!x))];
    const { data: posts } = postIds.length
      ? await admin.from("posts").select("id, title, author_id").in("id", postIds)
      : { data: [] as Array<{ id: string; title: string; author_id: string }> };
    const postMap = new Map((posts ?? []).map((p) => [p.id, p]));
    return (data ?? []).map((r) => ({
      ...r,
      reporter: reporters.get(r.reporter_id) ?? null,
      post: r.post_id ? postMap.get(r.post_id) ?? null : null,
    }));
  }

  if (queue === "kids") {
    // Phase 2 convention: posts.category holds the category slug; kids
    // categories are flagged is_kids. Submissions awaiting approval are
    // published stories in kids categories with is_kids_approved=false.
    const { data: kidsCats } = await admin.from("categories").select("slug").eq("is_kids", true);
    const slugs = (kidsCats ?? []).map((c) => c.slug);
    if (slugs.length === 0) return [];
    const { data } = await admin
      .from("posts")
      .select("id, author_id, title, language, category, created_at")
      .eq("status", "published")
      .eq("is_kids_approved", false)
      .in("category", slugs)
      .order("created_at", { ascending: true })
      .limit(100);
    const authors = await authorMap(admin, (data ?? []).map((p) => p.author_id));
    return (data ?? []).map((p) => ({ ...p, author: authors.get(p.author_id) ?? null }));
  }

  // queue === "originality"
  const { data } = await admin
    .from("posts")
    .select("id, author_id, title, language, originality_status, originality_evidence, created_at")
    .in("originality_status", ["possible_duplication", "strong_evidence"])
    .order("created_at", { ascending: false })
    .limit(100);
  const authors = await authorMap(admin, (data ?? []).map((p) => p.author_id));
  return (data ?? []).map((p) => ({ ...p, author: authors.get(p.author_id) ?? null }));
}

export interface DashboardStats {
  users: number;
  stories: number;
  pendingReview: number;
  openReports: number;
  kidsQueue: number;
  openAppeals: number;
}

async function count(admin: AdminClient, table: string, filter?: (q: any) => any): Promise<number> {
  let q = admin.from(table).select("id", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count: n } = await q;
  return n ?? 0;
}

export async function getDashboardStats(admin: AdminClient): Promise<DashboardStats> {
  const [users, stories, pendingReview, openReports, openAppeals] = await Promise.all([
    count(admin, "profiles"),
    count(admin, "posts"),
    count(admin, "posts", (q) => q.eq("status", "pending_review")),
    count(admin, "reports", (q) => q.eq("status", "open")),
    count(admin, "appeals", (q) => q.eq("status", "open")),
  ]);
  const kidsQueue = (await getModerationQueue(admin, "kids")).length;
  return { users, stories, pendingReview, openReports, kidsQueue, openAppeals };
}
