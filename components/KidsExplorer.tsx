"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FontSizeToggle, type KidsFontSize } from "./FontSizeToggle";
import { KidsStoryCard, type KidsStory } from "./KidsStoryCard";
import { EmptyState } from "./ui/EmptyState";
import { Input } from "./ui/Input";

const FONT_KEY = "qissa-kids-font";

export interface KidsExplorerCategory {
  slug: string;
  name: string;
}

interface KidsExplorerLabels {
  searchPlaceholder: string;
  allStories: string;
  readStory: string;
  fontSize: string;
  small: string;
  medium: string;
  large: string;
  continueReading: string;
  emptyTitle: string;
  emptyBody: string;
}

/** Search + category chips + font-size toggle + story grid for Kids' Corner. */
export function KidsExplorer({
  lang,
  stories,
  categories,
  continueReading,
  labels,
}: {
  lang: string;
  stories: KidsStory[];
  categories: KidsExplorerCategory[];
  continueReading: KidsStory[];
  labels: KidsExplorerLabels;
}) {
  const [q, setQ] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [fontSize, setFontSize] = useState<KidsFontSize>("m");

  // Restore the reader's preferred text size.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(FONT_KEY);
      if (saved === "s" || saved === "m" || saved === "l") setFontSize(saved);
    } catch {
      /* private mode — ignore */
    }
  }, []);

  const changeFontSize = (size: KidsFontSize) => {
    setFontSize(size);
    try {
      window.localStorage.setItem(FONT_KEY, size);
    } catch {
      /* private mode — ignore */
    }
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return stories.filter((s) => {
      if (activeCategory && s.category !== activeCategory) return false;
      if (!term) return true;
      return (
        s.title.toLowerCase().includes(term) || s.content.toLowerCase().includes(term)
      );
    });
  }, [stories, q, activeCategory]);

  return (
    <div>
      {continueReading.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-2xl font-extrabold text-neutral-900 dark:text-white">
            {labels.continueReading}
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {continueReading.map((s) => (
              <Link
                key={s.id}
                href={`/${lang}/kids/story/${s.id}`}
                lang={s.language}
                dir={s.language === "ur" ? "rtl" : "ltr"}
                className="w-56 shrink-0 rounded-3xl border-2 border-violet-200 bg-violet-50 p-5 transition hover:-translate-y-1 hover:shadow-md dark:border-violet-800/50 dark:bg-violet-900/20"
              >
                <p className="line-clamp-2 text-lg font-bold text-neutral-900 dark:text-white">
                  {s.title}
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-300">
                  {s.content.slice(0, 90)}…
                </p>
                <span className="mt-3 inline-block text-sm font-bold text-violet-700 dark:text-violet-300">
                  {labels.readStory} →
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full max-w-md">
          <Input
            aria-label={labels.searchPlaceholder}
            placeholder={labels.searchPlaceholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="rounded-full border-2 px-5 py-2.5 text-base"
          />
        </div>
        <FontSizeToggle
          value={fontSize}
          onChange={changeFontSize}
          labels={{ fontSize: labels.fontSize, small: labels.small, medium: labels.medium, large: labels.large }}
        />
      </div>

      {categories.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory("")}
            className={`rounded-full px-5 py-2 text-sm font-bold transition ${
              activeCategory === ""
                ? "bg-violet-600 text-white"
                : "bg-white text-neutral-600 hover:bg-violet-100 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
            }`}
          >
            {labels.allStories}
          </button>
          {categories.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => setActiveCategory(c.slug)}
              className={`rounded-full px-5 py-2 text-sm font-bold transition ${
                activeCategory === c.slug
                  ? "bg-violet-600 text-white"
                  : "bg-white text-neutral-600 hover:bg-violet-100 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState title={labels.emptyTitle} description={labels.emptyBody} />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((story) => (
            <KidsStoryCard
              key={story.id}
              lang={lang}
              story={story}
              readLabel={labels.readStory}
              fontSize={fontSize}
            />
          ))}
        </div>
      )}
    </div>
  );
}
