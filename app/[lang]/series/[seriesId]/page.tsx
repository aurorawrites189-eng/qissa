import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isLocale } from "@/lib/i18n/config";
import { Button } from "@/components/ui/Button";
import { publicStorageUrl } from "@/lib/storage";

interface EpisodeRow {
  id: string;
  title: string;
  episode_number: number | null;
  published_at: string | null;
  cover: string | null;
}

/**
 * Series detail: /[lang]/series/[seriesId]
 * Episode list + author tools.
 */
export default async function SeriesDetailPage({
  params: _params,
}: {
  params: Promise<{ lang: string; seriesId: string }>;
}) {
  const params = await _params;
  if (!isLocale(params.lang)) notFound();
  const lang = params.lang;
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: s } = await supabase
    .from("series")
    .select("id, title, description, genre, language, status, author_id, cover_url, created_at")
    .eq("id", params.seriesId)
    .maybeSingle();
  if (!s) notFound();
  const series = s as {
    id: string;
    title: string;
    description: string | null;
    genre: string | null;
    language: string;
    status: string;
    author_id: string | null;
    cover_url: string | null;
  };

  const { data: episodes } = await supabase
    .from("posts")
    .select("id, title, episode_number, published_at, post_images(storage_path)")
    .eq("series_id", series.id)
    .eq("status", "published")
    .order("episode_number", { ascending: true });
  const epList = (
    (episodes ?? []) as unknown as (Omit<EpisodeRow, "cover"> & {
      post_images: { storage_path: string }[] | null;
    })[]
  )
    .map((e) => ({ ...e, cover: e.post_images?.[0]?.storage_path ?? null }))
    .sort((a, b) => (a.episode_number ?? 0) - (b.episode_number ?? 0));

  const isAuthor = !!user && !!series.author_id && user.id === series.author_id;
  const t = dict.series as Record<string, string>;

  // Author's own pending episodes (awaiting admin approval).
  let pendingEps: EpisodeRow[] = [];
  if (isAuthor) {
    const { data: pending } = await supabase
      .from("posts")
      .select("id, title, episode_number, published_at")
      .eq("series_id", series.id)
      .eq("status", "pending_review")
      .order("episode_number", { ascending: true });
    pendingEps = (pending ?? []) as EpisodeRow[];
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href={`/series`}
        className="text-sm font-medium text-indigo-700 underline dark:text-indigo-400"
      >
        ← {t.title}
      </Link>

      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          {series.genre && (
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
              {series.genre}
            </span>
          )}
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              series.status === "completed"
                ? "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
            }`}
          >
            {series.status === "completed" ? t.completed : t.ongoing}
          </span>
        </div>
        <h1 className="mt-3 text-3xl font-extrabold md:text-4xl">{series.title}</h1>
        {series.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={series.cover_url}
            alt={series.title}
            className="mt-5 aspect-[16/9] w-full rounded-3xl object-cover shadow-md"
            loading="lazy"
          />
        )}
        {series.description && (
          <p className="mt-3 text-neutral-600 dark:text-neutral-300">{series.description}</p>
        )}
        {isAuthor && (
          <div className="mt-4">
            <Link href={`/series/${series.id}/new`}>
              <Button>{t.addEpisode}</Button>
            </Link>
          </div>
        )}
      </header>

      <h2 className="mt-10 text-xl font-bold">
        {t.episodes} ({epList.length})
      </h2>
      {pendingEps.length > 0 && (
        <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            ⏳ {t.pendingApproval} ({pendingEps.length})
          </p>
          <ul className="mt-2 space-y-1">
            {pendingEps.map((ep) => (
              <li key={ep.id} className="text-sm text-neutral-600 dark:text-neutral-300">
                {t.episode} {ep.episode_number ?? ""}: {ep.title}
              </li>
            ))}
          </ul>
        </div>
      )}
      {epList.length === 0 ? (
        <p className="mt-3 text-neutral-500">{t.emptyTitle}</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {epList.map((ep) => (
            <li key={ep.id}>
              <Link
                href={`/series/${series.id}/${ep.episode_number ?? 1}`}
                className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4 transition hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900"
              >
                {ep.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={publicStorageUrl("post-images", ep.cover)}
                    alt={ep.title}
                    className="h-14 w-20 shrink-0 rounded-xl object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
                    {ep.episode_number ?? "•"}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold">{ep.title}</p>
                  <p className="text-xs text-neutral-500">
                    {t.episode} {ep.episode_number ?? ""}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
