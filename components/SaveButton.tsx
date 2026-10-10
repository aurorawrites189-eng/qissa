"use client";

import { useState } from "react";
import type { Locale } from "@/lib/site-config";
import type { Dictionary } from "@/lib/i18n/types";

interface SaveButtonProps {
  postId: string;
  lang: Locale;
  dict: Dictionary;
  initialSaved: boolean;
  signedIn: boolean;
}

export function SaveButton({ postId, lang, dict, initialSaved, signedIn }: SaveButtonProps) {
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const next = !saved;
    setSaved(next); // optimistic
    try {
      const res = await fetch(`/${lang}/api/posts/${postId}/save`, {
        method: next ? "POST" : "DELETE",
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setSaved(data.saved);
    } catch {
      setSaved(!next);
    } finally {
      setBusy(false);
    }
  };

  if (!signedIn) {
    return (
      <a
        href={`/${lang}/login`}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        aria-label={dict.social.save}
      >
        <span aria-hidden>🔖</span> {dict.social.save}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={saved}
      aria-label={saved ? dict.social.saved : dict.social.save}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-60 ${
        saved
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
          : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
      }`}
    >
      <span aria-hidden>{saved ? "📌" : "🔖"}</span>
      {saved ? dict.social.saved : dict.social.save}
    </button>
  );
}
