import Link from "next/link";
import { publicStorageUrl } from "@/lib/storage";

export interface PostCardAuthor {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface PostCardPost {
  id: string;
  title: string;
  language: string;
  excerpt?: string;
  category?: string | null;
  categoryName?: string | null;
  published_at?: string | null;
  wordCount?: number;
  author?: PostCardAuthor | null;
  cover?: { storage_path: string; alt_text?: string | null } | null;
}

interface PostCardLabels {
  by: string;
  words: string;
  readMore: string;
}

/** A story teaser card. Links to /[lang]/posts/[id] (reader page, Phase 3). */
export function PostCard({
  lang,
  post,
  labels,
}: {
  lang: string;
  post: PostCardPost;
  labels: PostCardLabels;
}) {
  const href = `/${lang}/posts/${post.id}`;
  const authorName = post.author?.display_name || post.author?.username;
  const date = post.published_at
    ? new Date(post.published_at).toLocaleDateString(lang === "ur" ? "ur-PK" : "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <article
      lang={post.language}
      dir={post.language === "ur" ? "rtl" : "ltr"}
      className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900"
    >
      {post.cover && (
        <Link href={href} className="block aspect-[16/9] overflow-hidden bg-neutral-100 dark:bg-neutral-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={publicStorageUrl("post-images", post.cover.storage_path)}
            alt={post.cover.alt_text ?? post.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </Link>
      )}
      <div className="flex flex-1 flex-col gap-2 p-5">
        {post.categoryName && (
          <span className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
            {post.categoryName}
          </span>
        )}
        <Link href={href}>
          <h2 className="text-lg font-bold leading-snug hover:text-emerald-700 dark:hover:text-emerald-400">
            {post.title}
          </h2>
        </Link>
        {post.excerpt && (
          <p className="line-clamp-3 flex-1 text-sm text-neutral-600 dark:text-neutral-300">
            {post.excerpt}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
          {post.author && (
            <span className="flex items-center gap-1.5">
              {post.author.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.author.avatar_url}
                  alt={authorName ?? ""}
                  className="h-5 w-5 rounded-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-700 text-[10px] font-bold text-white">
                  {(authorName ?? "?").charAt(0).toUpperCase()}
                </span>
              )}
              <span>
                {labels.by} {authorName}
              </span>
            </span>
          )}
          {date && <span>{date}</span>}
          {typeof post.wordCount === "number" && (
            <span>
              {post.wordCount} {labels.words}
            </span>
          )}
        </div>
        <Link
          href={href}
          className="mt-1 text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          {labels.readMore} →
        </Link>
      </div>
    </article>
  );
}
