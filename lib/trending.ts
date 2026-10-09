/**
 * Trending-feed tunables (shared, non-route module).
 *
 * These lived in app/[lang]/api/feed/trending/route.ts as exported consts,
 * which Next.js 14 rejects ("not a valid Route export field") at build
 * time. They are imported by the route instead — same documented values.
 */

/** How much one like weighs relative to one view in the trending score. */
export const LIKE_WEIGHT = 10;

/** Trending window in days — only posts published within this window rank. */
export const TRENDING_WINDOW_DAYS = 30;
