"use client";

import { useEffect } from "react";
import type { Locale } from "@/lib/site-config";

/**
 * Fire-and-forget view counter. POSTs once on mount; the promise is
 * intentionally not awaited and failures are swallowed so counting can
 * never break rendering. See the views route for the inflation caveats.
 */
export function ViewCounter({ postId, lang }: { postId: string; lang: Locale }) {
  useEffect(() => {
    // NOTE: React 18 StrictMode double-invokes effects in development, so
    // views may count twice locally. Production builds are unaffected.
    fetch(`/api/posts/${postId}/views`, { method: "POST" }).catch(() => {});
  }, [postId, lang]);

  return null;
}
