import type { MetadataRoute } from "next";
import { SITE, type Locale } from "@/lib/site-config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";
// Sitemap reflects database content, so it must run at request time
// (revalidated hourly) instead of being frozen at build time.
export const dynamic = "force-dynamic";
export const revalidate = 3600;

/**
 * Sitemap for NazmHub.
 *
 * Static locale routes plus every published public post:
 *   /{lang}/posts/{id}          — regular articles & stories
 *   /{lang}/kids/story/{id}     — kids-approved stories only
 * Each URL uses the post's own language, not both locales.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE.url.replace(/\/$/, "");

  const staticPaths: Array<{
    path: string;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
    priority: number;
  }> = [
    { path: "", changeFrequency: "daily", priority: 1 },
    { path: "/feed", changeFrequency: "daily", priority: 0.9 },
    { path: "/kids", changeFrequency: "daily", priority: 0.9 },
    { path: "/series", changeFrequency: "daily", priority: 0.9 },
    { path: "/about", changeFrequency: "monthly", priority: 0.5 },
    { path: "/privacy", changeFrequency: "monthly", priority: 0.5 },
    { path: "/contact", changeFrequency: "monthly", priority: 0.5 },
    { path: "/login", changeFrequency: "monthly", priority: 0.3 },
    { path: "/signup", changeFrequency: "monthly", priority: 0.3 },
    { path: "/write", changeFrequency: "monthly", priority: 0.5 },
  ];

  const entries: MetadataRoute.Sitemap = [];
  for (const lang of SITE.locales as readonly Locale[]) {
    for (const { path, changeFrequency, priority } of staticPaths) {
      entries.push({
        url: `${base}/${lang}${path}`,
        lastModified: new Date(),
        changeFrequency,
        priority,
      });
    }
  }

  // ---- Dynamic post URLs (published + public only) ----
  try {
    const supabase = await createClient();
    const { data: posts } = await supabase
      .from("posts")
      .select("id, language, updated_at, published_at, is_kids_approved")
      .eq("status", "published")
      .eq("visibility", "public")
      .order("published_at", { ascending: false })
      .limit(5000);

    for (const post of posts ?? []) {
      const lang = (post.language === "ur" ? "ur" : "en") as Locale;
      const lastModified = new Date(
        post.updated_at ?? post.published_at ?? Date.now()
      );
      entries.push({
        url: `${base}/${lang}/posts/${post.id}`,
        lastModified,
        changeFrequency: "weekly",
        priority: 0.7,
      });
      if (post.is_kids_approved) {
        entries.push({
          url: `${base}/${lang}/kids/story/${post.id}`,
          lastModified,
          changeFrequency: "weekly",
          priority: 0.8,
        });
      }
    }
  } catch {
    // If the DB is unreachable, still serve the static routes.
  }

  // ---- Serial series + episode URLs ----
  try {
    const supabase = await createClient();
    const { data: allSeries } = await supabase
      .from("series")
      .select("id, language, created_at")
      .limit(500);
    for (const s of allSeries ?? []) {
      const lang = (s.language === "ur" ? "ur" : "en") as Locale;
      entries.push({
        url: `${base}/${lang}/series/${s.id}`,
        lastModified: new Date(s.created_at ?? Date.now()),
        changeFrequency: "weekly",
        priority: 0.8,
      });
      const { data: eps } = await supabase
        .from("posts")
        .select("episode_number, updated_at, published_at")
        .eq("series_id", s.id)
        .eq("status", "published")
        .order("episode_number", { ascending: true })
        .limit(100);
      for (const ep of eps ?? []) {
        if (!ep.episode_number) continue;
        entries.push({
          url: `${base}/${lang}/series/${s.id}/${ep.episode_number}`,
          lastModified: new Date(ep.updated_at ?? ep.published_at ?? Date.now()),
          changeFrequency: "weekly",
          priority: 0.7,
        });
      }
    }
  } catch {
    // Series table may not exist yet (pre-migration) — skip quietly.
  }

  return entries;
}
