import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isLocale } from "@/lib/i18n/config";
import { Button } from "@/components/ui/Button";

interface SeriesRow {
  id: string;
  title: string;
  description: string | null;
  genre: string | null;
  language: string;
  status: string;
  created_at: string;
}

/**
 * Serials shelf: /[lang]/series
 * Episode-wise novels with cliffhangers. Writers can start their own series.
 */
export default async function SeriesPage({ params: _params }: { params: Promise<{ lang: string }> }) {
  const params = await _params;
  if (!isLocale(params.lang)) notFound();
  const lang = params.lang;
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: series } = await supabase
    .from("series")
    .select("id, title, description, genre, language, status, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  // Episode counts per series.
  const seriesList = (series ?? []) as SeriesRow[];
  const counts = new Map<string, number>();
  if (seriesList.length > 0) {
    const { data: eps } = await supabase
      .from("posts")
      .select("series_id")
      .in(
        "series_id",
        seriesList.map((s) => s.id)
      )
      .eq("status", "published");
    for (const e of (eps ?? []) as { series_id: string }[]) {
      counts.set(e.series_id, (counts.get(e.series_id) ?? 0) + 1);
    }
  }

  const t = dict.series as Record<string, string>;

  // Split the shelf into separate Urdu and English sections (aurora, Oct 20).
  const isEnglish = (s: SeriesRow) => (s.language ?? "").toLowerCase().startsWith("en");
  const groups: { key: string; heading: string; items: SeriesRow[] }[] = [
    { key: "ur", heading: t.urduSection, items: seriesList.filter((s) => !isEnglish(s)) },
    { key: "en", heading: t.englishSection, items: seriesList.filter(isEnglish) },
  ];

  return (
    <div className="bg-gradient-to-b from-indigo-50 via-white to-amber-50 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-extrabold text-indigo-800 sm:text-5xl dark:text-indigo-300">
            {t.title}
          </h1>
          <p className="mt-3 text-lg text-neutral-600 dark:text-neutral-300">{t.subtitle}</p>
          <div className="mt-5">
            {user ? (
              <Link href={`/series/new`}>
                <Button>{t.newSeries}</Button>
              </Link>
            ) : (
              <p className="text-sm text-neutral-500">
                <Link href={`/login`} className="font-medium text-indigo-700 underline dark:text-indigo-400">
                  {t.loginToCreate}
                </Link>
              </p>
            )}
          </div>
        </div>

        {seriesList.length === 0 ? (
          <div className="mx-auto max-w-md rounded-2xl border border-dashed border-neutral-300 p-10 text-center dark:border-neutral-700">
            <p className="text-4xl" aria-hidden>
              📚
            </p>
            <h2 className="mt-3 text-xl font-bold">{t.emptyTitle}</h2>
            <p className="mt-2 text-neutral-600 dark:text-neutral-300">{t.emptyBody}</p>
          </div>
        ) : (
          groups
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <section key={g.key} className="mb-12">
                <h2 className="mb-5 text-2xl font-bold text-indigo-800 dark:text-indigo-300">{g.heading}</h2>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {g.items.map((s) => (
              <Link
                key={s.id}
                href={`/series/${s.id}`}
                className="group rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
                    {s.genre ?? "—"}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      s.status === "completed"
                        ? "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                    }`}
                  >
                    {s.status === "completed" ? t.completed : t.ongoing}
                  </span>
                </div>
                <h2 className="mt-3 text-xl font-bold leading-snug group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
                  {s.title}
                </h2>
                {s.description && (
                  <p className="mt-2 line-clamp-3 text-sm text-neutral-600 dark:text-neutral-300">
                    {s.description}
                  </p>
                )}
                <p className="mt-4 text-sm font-medium text-neutral-500">
                  {counts.get(s.id) ?? 0} {t.episodes}
                </p>
              </Link>
                  ))}
                </div>
              </section>
            ))
        )}
      </div>
    </div>
  );
}
