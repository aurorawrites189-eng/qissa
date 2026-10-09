import Link from "next/link";
import { publicStorageUrl } from "@/lib/storage";
import type { KidsFontSize } from "./FontSizeToggle";

export interface KidsStory {
  id: string;
  title: string;
  content: string;
  language: string;
  category: string | null;
  categoryName: string | null;
  cover: { storage_path: string; alt_text: string | null } | null;
}

/** Big, rounded, colorful story card for young readers. */
export function KidsStoryCard({
  lang,
  story,
  readLabel,
  fontSize,
}: {
  lang: string;
  story: KidsStory;
  readLabel: string;
  fontSize: KidsFontSize;
}) {
  // Rotate through cheerful pastel themes so the shelf feels playful.
  const themes = [
    "bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800/50",
    "bg-sky-100 dark:bg-sky-900/30 border-sky-200 dark:border-sky-800/50",
    "bg-rose-100 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800/50",
    "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800/50",
    "bg-violet-100 dark:bg-violet-900/30 border-violet-200 dark:border-violet-800/50",
    "bg-orange-100 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800/50",
  ];
  let hash = 0;
  for (let i = 0; i < story.id.length; i++) hash = (hash * 31 + story.id.charCodeAt(i)) >>> 0;
  const theme = themes[hash % themes.length];

  const titleSize = { s: "text-xl", m: "text-2xl", l: "text-3xl" }[fontSize];
  const bodySize = { s: "text-base", m: "text-lg", l: "text-xl" }[fontSize];

  const href = `/${lang}/kids/story/${story.id}`;

  return (
    <article
      lang={story.language}
      dir={story.language === "ur" ? "rtl" : "ltr"}
      className={`flex flex-col overflow-hidden rounded-3xl border-2 ${theme} transition hover:-translate-y-1 hover:shadow-lg`}
    >
      {story.cover && (
        <Link href={href} className="block aspect-[16/10] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={publicStorageUrl("post-images", story.cover.storage_path)}
            alt={story.cover.alt_text ?? story.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </Link>
      )}
      <div className="flex flex-1 flex-col gap-3 p-6">
        {story.categoryName && (
          <span className="w-fit rounded-full bg-white/80 px-4 py-1 text-sm font-bold text-neutral-700 dark:bg-neutral-900/60 dark:text-neutral-200">
            {story.categoryName}
          </span>
        )}
        <Link href={href}>
          <h2 className={`${titleSize} font-extrabold leading-snug text-neutral-900 dark:text-white`}>
            {story.title}
          </h2>
        </Link>
        <p className={`${bodySize} line-clamp-4 flex-1 leading-relaxed text-neutral-700 dark:text-neutral-200`}>
          {story.content.slice(0, 200)}
          {story.content.length > 200 ? "…" : ""}
        </p>
        <Link
          href={href}
          className="mt-2 inline-flex w-fit items-center gap-2 rounded-full bg-violet-600 px-6 py-2.5 text-base font-bold text-white transition hover:bg-violet-700"
        >
          {readLabel} →
        </Link>
      </div>
    </article>
  );
}
