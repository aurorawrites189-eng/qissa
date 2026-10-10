/**
 * Site configuration — THE single place where the site name lives.
 * All other code should import SITE from here instead of hardcoding the name.
 */
export const SITE = {
  name: "NazmHub",
  nameUrdu: "نظم",
  tagline: "Write. Read. Belong.",
  taglineUrdu: "لکھیں۔ پڑھیں۔ جڑیں۔",
  locales: ["en", "ur"] as const,
  defaultLocale: "en" as const,
  /**
   * Canonical base URL for absolute links (sitemap, robots, metadata).
   * Set NEXT_PUBLIC_SITE_URL in production (e.g. the Cloudflare Pages URL);
   * falls back to localhost for local development.
   */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
} as const;

export type Locale = (typeof SITE.locales)[number];
