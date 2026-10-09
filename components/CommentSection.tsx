"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/site-config";
import type { Dictionary } from "@/lib/i18n/types";
import { Button } from "./ui/Button";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  author: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null;
}

interface CommentSectionProps {
  postId: string;
  lang: Locale;
  dict: Dictionary;
  /** Signed in AND adult. Kids and signed-out users see read-only states. */
  canComment: boolean;
  signedIn: boolean;
  isChild: boolean;
}

export function CommentSection({ postId, lang, dict, canComment, signedIn, isChild }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/${lang}/api/posts/${postId}/comments`)
      .then((r) => (r.ok ? r.json() : { comments: [] }))
      .then((d) => {
        if (!cancelled) {
          setComments(d.comments ?? []);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [postId, lang]);

  const post = async () => {
    const content = draft.trim();
    if (!content || posting) return;
    setPosting(true);
    setError(false);
    try {
      const res = await fetch(`/${lang}/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setComments((cs) => [...cs, { ...data.comment, author: null }]);
      setDraft("");
      // Refresh to get author info attached.
      fetch(`/${lang}/api/posts/${postId}/comments`)
        .then((r) => r.json())
        .then((d) => setComments(d.comments ?? []))
        .catch(() => {});
    } catch {
      setError(true);
    } finally {
      setPosting(false);
    }
  };

  return (
    <section aria-label={dict.comments.title} className="mt-10">
      <h2 className="text-xl font-bold">
        {dict.comments.title} <span className="text-sm font-normal text-neutral-500">({comments.length})</span>
      </h2>

      <div className="mt-4 space-y-4">
        {!loaded && <p className="text-sm text-neutral-500">{dict.common.loading}…</p>}
        {loaded && comments.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{dict.comments.empty}</p>
        )}
        {comments.map((c) => (
          <article key={c.id} className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold">
                {c.author?.display_name ?? c.author?.username ?? "…"}
              </span>
              {c.author?.username && (
                <span className="text-xs text-neutral-500">@{c.author.username}</span>
              )}
              <time className="ms-auto text-xs text-neutral-400" dateTime={c.created_at}>
                {new Date(c.created_at).toLocaleDateString(lang)}
              </time>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-200">{c.content}</p>
          </article>
        ))}
      </div>

      <div className="mt-4">
        {canComment ? (
          <div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={dict.comments.placeholder}
              rows={3}
              maxLength={2000}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            />
            {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{dict.comments.error}</p>}
            <div className="mt-2 flex justify-end">
              <Button onClick={post} loading={posting} disabled={draft.trim().length === 0}>
                {dict.comments.submit}
              </Button>
            </div>
          </div>
        ) : isChild ? (
          <p className="rounded-xl bg-neutral-100 p-4 text-sm text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            {dict.comments.kidsOff}
          </p>
        ) : (
          !signedIn && (
            <p className="rounded-xl bg-neutral-100 p-4 text-sm text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              {dict.comments.signIn}
            </p>
          )
        )}
      </div>
    </section>
  );
}
