"use client";

import { useState } from "react";
import type { Locale } from "@/lib/site-config";
import type { Dictionary } from "@/lib/i18n/types";

interface FollowButtonProps {
  username: string;
  lang: Locale;
  dict: Dictionary;
  initialFollowing: boolean;
  signedIn: boolean;
  /** Hide entirely when the viewer is the author or a kid (no follow UI). */
  canFollow: boolean;
}

export function FollowButton({ username, lang, dict, initialFollowing, signedIn, canFollow }: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  if (!canFollow) return null;

  if (!signedIn) {
    return (
      <a
        href={`/${lang}/auth/login`}
        className="rounded-lg bg-emerald-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
      >
        {dict.social.follow}
      </a>
    );
  }

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const next = !following;
    setFollowing(next); // optimistic
    try {
      const res = await fetch(`/${lang}/api/follow/${encodeURIComponent(username)}`, {
        method: next ? "POST" : "DELETE",
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setFollowing(data.following);
    } catch {
      setFollowing(!next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={following}
      className={`rounded-lg px-4 py-1.5 text-sm font-medium transition disabled:opacity-60 ${
        following
          ? "bg-neutral-200 text-neutral-800 hover:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
          : "bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
      }`}
    >
      {following ? dict.social.following : dict.social.follow}
    </button>
  );
}
