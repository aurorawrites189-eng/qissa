import type { MetadataRoute } from "next";
import { SITE, type Locale } from "@/lib/site-config";

export const runtime = "edge";

/**
 * Static sitemap for Qissa.
 *
 * Lists the static locale routes. Dynamic post URLs (/{lang}/posts/[id])
 * are NOT included here because the sitemap is generated at build time
 * with no database access configured — hook them in by querying
 * published posts at request time. See the commented block at the bottom
 * of this file for the exact insertion point and query to use.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE.url.replace(/\/$/, "");

  const staticPaths: Array<{ path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }> = [
    { path: "", changeFrequency: "daily", priority: 1 },
    { path: "/feed", changeFrequency: "daily", priority: 0.9 },
    { path: "/kids", changeFrequency: "daily", priority: 0.9 },
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

  // ------------------------------------------------------------------
  // DYNAMIC POST URL HOOK (not wired yet — needs a live DB at request time)
  //
  // To include published posts, make this function async and insert:
  //
  //   import { createClient } from "@/lib/supabase/server";
  //   const supabase = await createClient();
  //   const { data: posts } = await supabase
  //     .from("posts")
  //     .select("id, updated_at")
  //     .eq("status", "published")
  //     .eq("visibility", "public");
  //   for (const post of posts ?? []) {
  //     for (const lang of SITE.locales as readonly Locale[]) {
  //       entries.push({
  //         url: `${base}/${lang}/posts/${post.id}`,
  //         lastModified: new Date(post.updated_at),
  //         changeFrequency: "weekly",
  //         priority: 0.7,
  //       });
  //     }
  //   }
  //
  // Deliberately left out: /admin/*, /dashboard, /write/[id] (private),
  // and unlisted posts (visibility != 'public').
  // ------------------------------------------------------------------

  return entries;
}
