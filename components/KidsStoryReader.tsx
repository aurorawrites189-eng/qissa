"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { FontSizeToggle, type KidsFontSize } from "./FontSizeToggle";
import { KidsReportButton } from "./KidsReportButton";
import { parseDialogueContent } from "@/lib/kids-dialogue";

const FONT_KEY = "qissa-kids-font";

export interface ReaderStory {
  id: string;
  title: string;
  content: string;
  language: string;
  categoryName: string | null;
  authorName: string | null;
}

interface ReaderLabels {
  backToStories: string;
  fontSize: string;
  small: string;
  medium: string;
  large: string;
  reportStory: string;
  reportReason: string;
  reportDetails: string;
  submitReport: string;
  cancel: string;
  reportSent: string;
  reportLogin: string;
  reasonInappropriate: string;
  reasonScary: string;
  reasonOther: string;
}

/**
 * Large-type story reader for kids. Records reading history best-effort:
 * first via POST /[lang]/api/kids/history, and if that doesn't return JSON
 * (the Phase-1 middleware redirects child accounts away from /api/* paths),
 * falls back to a direct upsert — RLS allows owner-only history writes.
 */
export function KidsStoryReader({
  lang,
  story,
  labels,
}: {
  lang: string;
  story: ReaderStory;
  labels: ReaderLabels;
}) {
  const [fontSize, setFontSize] = useState<KidsFontSize>("m");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(FONT_KEY);
      if (saved === "s" || saved === "m" || saved === "l") setFontSize(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const changeFontSize = (size: KidsFontSize) => {
    setFontSize(size);
    try {
      window.localStorage.setItem(FONT_KEY, size);
    } catch {
      /* ignore */
    }
  };

  // Record this read (best-effort — never blocks the story).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const record = async (): Promise<boolean> => {
        try {
          const res = await fetch(`/api/kids/history`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ post_id: story.id }),
          });
          const ct = res.headers.get("content-type") ?? "";
          return res.ok && ct.includes("application/json");
        } catch {
          return false;
        }
      };

      const viaApi = await record();
      if (!viaApi && !cancelled) {
        // Fallback: direct upsert (RLS reading_history_insert_own /
        // reading_history_update_own allow this for any signed-in user).
        await supabase.from("reading_history").upsert(
          {
            user_id: user.id,
            post_id: story.id,
            last_read_at: new Date().toISOString(),
          },
          { onConflict: "user_id,post_id" }
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lang, story.id]);

  const bodySize = {
    s: "text-lg leading-9",
    m: "text-xl leading-10",
    l: "text-2xl leading-[2.75rem]",
  }[fontSize];

  // Picture-dialogue stories: every dialogue turn starts with its illustration.
  const dialogue = parseDialogueContent(story.content);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/kids`}
          className="inline-flex items-center gap-1 rounded-full bg-white px-4 py-2 text-sm font-bold text-violet-700 shadow-sm hover:bg-violet-50 dark:bg-neutral-900 dark:text-violet-300 dark:hover:bg-neutral-800"
        >
          ← {labels.backToStories}
        </Link>
        <FontSizeToggle
          value={fontSize}
          onChange={changeFontSize}
          labels={{ fontSize: labels.fontSize, small: labels.small, medium: labels.medium, large: labels.large }}
        />
      </div>

      <article
        lang={story.language}
        dir={story.language === "ur" ? "rtl" : "ltr"}
        className="rounded-3xl border-2 border-violet-200 bg-white p-6 shadow-sm sm:p-10 dark:border-violet-800/40 dark:bg-neutral-900"
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {story.categoryName && (
            <span className="rounded-full bg-violet-100 px-4 py-1 text-sm font-bold text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">
              {story.categoryName}
            </span>
          )}
          <span className="rounded-full bg-amber-100 px-4 py-1 text-sm font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            {story.language === "ur" ? "اردو" : "English"}
          </span>
        </div>

        <h1 className="mb-2 text-3xl font-extrabold text-neutral-900 sm:text-4xl dark:text-white">
          {story.title}
        </h1>
        {story.authorName && (
          <p className="mb-8 text-base text-neutral-500 dark:text-neutral-400">{story.authorName}</p>
        )}

        {dialogue ? (
          <div className="flex flex-col gap-8">
            {dialogue.turns.map((turn, i) => (
              <figure
                key={i}
                className="overflow-hidden rounded-3xl border-2 border-violet-100 bg-violet-50/50 dark:border-violet-800/40 dark:bg-neutral-800/40"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={turn.img}
                  alt={`${turn.speaker}`}
                  className="aspect-[4/3] w-full object-cover"
                  loading={i === 0 ? "eager" : "lazy"}
                />
                <figcaption className="p-5 sm:p-6">
                  <p className="mb-2 inline-block rounded-full bg-violet-600 px-4 py-1 text-base font-extrabold text-white">
                    {turn.speaker}
                  </p>
                  <p className={`${bodySize} text-neutral-800 dark:text-neutral-100`}>
                    {turn.line}
                  </p>
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <div className={`${bodySize} whitespace-pre-wrap text-neutral-800 dark:text-neutral-100`}>
            {story.content}
          </div>
        )}
      </article>

      <div className="mt-6">
        <KidsReportButton
          lang={lang}
          postId={story.id}
          labels={{
            reportStory: labels.reportStory,
            reportReason: labels.reportReason,
            reportDetails: labels.reportDetails,
            submitReport: labels.submitReport,
            cancel: labels.cancel,
            reportSent: labels.reportSent,
            reportLogin: labels.reportLogin,
            reasonInappropriate: labels.reasonInappropriate,
            reasonScary: labels.reasonScary,
            reasonOther: labels.reasonOther,
          }}
        />
      </div>
    </div>
  );
}
