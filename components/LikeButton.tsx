"use client";

import { useState } from "react";
import type { Locale } from "@/lib/site-config";
import type { Dictionary } from "@/lib/i18n/types";

interface LikeButtonProps {
  postId: string;
  lang: Locale;
  dict: Dictionary;
  initialLiked: boolean;
  initialCount: number;
  /** When false (signed out), the button links to sign-in instead. */
  signedIn: boolean;
}

export function LikeButton({ postId, lang, dict, initialLiked, initialCount, signedIn }: LikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    // Optimistic update.
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    try {
      const res = await fetch(`/${lang}/api/posts/${postId}/like`, {
        method: next ? "POST" : "DELETE",
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setLiked(data.liked);
      setCount(data.likeCount);
    } catch {
      // Roll back on failure.
      setLiked(!next);
      setCount((c) => c + (next ? -1 : 1));
    } finally {
      setBusy(false);
    }
  };

  if (!signedIn) {
    return (
      <a
        href={`/${lang}/auth/login`}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        aria-label={dict.social.like}
      >
        <span aria-hidden>♡</span> {count}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={liked}
      aria-label={liked ? dict.social.liked : dict.social.like}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-60 ${
        liked
          ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
          : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
      }`}
    >
      <span aria-hidden>{liked ? "♥" : "♡"}</span>
      <span>
        {count} {liked ? dict.social.liked : dict.social.like}
      </span>
    </button>
  );
}
