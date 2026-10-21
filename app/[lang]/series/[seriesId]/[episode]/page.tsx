import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isLocale } from "@/lib/i18n/config";
import { publicStorageUrl } from "@/lib/storage";

interface EpisodeRow {
  id: string;
  title: string;
  content: string;
  episode_number: number | null;
}

/**
 * Episode reader: /[lang]/series/[seriesId]/[episode]
 * Public — cliffhangers bring readers back, no gate.
 */
export default async function EpisodePage({
  params: _params,
}: {
  params: Promise<{ lang: string; seriesId: string; episode: string }>;
}) {
  const params = await _params;
  if (!isLocale(params.lang)) notFound();
  const lang = params.lang;
  const dict = await getDictionary(lang);
  const epNum = parseInt(params.episode, 10);
  if (!Number.isFinite(epNum) || epNum < 1) notFound();

  const supabase = await createClient();

  const { data: s } = await supabase
    .from("series")
    .select("id, title")
    .eq("id", params.seriesId)
    .maybeSingle();
  if (!s) notFound();

  const { data: ep } = await supabase
    .from("posts")
    .select("id, title, content, episode_number, post_images(storage_path)")
    .eq("series_id", params.seriesId)
    .eq("episode_number", epNum)
    .eq("status", "published")
    .maybeSingle();
  if (!ep) notFound();
  const episode = ep as EpisodeRow;
  const cover =
    (ep as { post_images?: { storage_path: string }[] | null }).post_images?.[0]?.storage_path ??
    null;

  // Prev / next episode numbers.
  const { data: neighbors } = await supabase
    .from("posts")
    .select("episode_number")
    .eq("series_id", params.seriesId)
    .eq("status", "published")
    .order("episode_number", { ascending: true });
  const nums = ((neighbors ?? []) as { episode_number: number | null }[])
    .map((n) => n.episode_number ?? 0)
    .filter((n) => n > 0);
  const idx = nums.indexOf(epNum);
  const prevNum = idx > 0 ? nums[idx - 1] : null;
  const nextNum = idx >= 0 && idx < nums.length - 1 ? nums[idx + 1] : null;

  const t = dict.series as Record<string, string>;
  const paragraphs = String(episode.content).split(/\n{2,}/);

  return (
    <article className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href={`/series/${params.seriesId}`}
        className="text-sm font-medium text-indigo-700 underline dark:text-indigo-400"
      >
        ← {(s as { title: string }).title} · {t.backToSeries}
      </Link>

      <header className="mt-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
          {t.episode} {epNum}
        </p>
        <h1 className="mt-1 text-3xl font-extrabold leading-tight md:text-4xl">{episode.title}</h1>
      </header>

      {cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={publicStorageUrl("post-images", cover)}
          alt={episode.title}
          className="mt-6 aspect-[16/9] w-full rounded-3xl object-cover shadow-md"
          loading="eager"
        />
      )}

      <div className="prose prose-neutral mt-6 max-w-none dark:prose-invert">
        {paragraphs.map((para, i) => (
          <p key={i} className="whitespace-pre-wrap">
            {para}
          </p>
        ))}
      </div>

      <nav className="mt-10 flex items-center justify-between gap-4 border-t border-neutral-200 pt-6 dark:border-neutral-800">
        <div>
          {prevNum !== null && (
            <Link
              href={`/series/${params.seriesId}/${prevNum}`}
              className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              ← {t.prevEpisode} {prevNum}
            </Link>
          )}
        </div>
        <div>
          {nextNum !== null ? (
            <Link
              href={`/series/${params.seriesId}/${nextNum}`}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"
            >
              {t.nextEpisode} {nextNum} →
            </Link>
          ) : (
            <span className="text-sm text-neutral-500">⏳ {t.ongoing}…</span>
          )}
        </div>
      </nav>
    </article>
  );
}
