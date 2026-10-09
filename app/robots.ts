import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site-config";

/**
 * robots.txt for Qissa.
 *
 * Private areas (/admin, /dashboard, /write, /api) are disallowed for all
 * crawlers. The sitemap index is advertised for discoverability.
 */
export default function robots(): MetadataRoute.Robots {
  const base = SITE.url.replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: ["/"],
      disallow: ["/api/", "/admin/", "/dashboard", "/write", "/auth/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
