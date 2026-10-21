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
  cover_url: string | null;
  created_at: string;
}

/** A serial counts as a finished book once all 12 of its episodes are published. */
const EPISODES_PER_SERIAL = 12;

/**
 * Download shelf: /[lang]/download (public clean URL: /download)
 * Only COMPLETED serials appear here — each one as a whole book:
 * read online on its series page, or download the free book PDF
 * (Supabase Storage bucket "books", file name = <series_id>.pdf).
 * Serials that are still running are never listed.
 */
export default async function DownloadPage({ params: _params }: { params: Promise<{ lang: string }> }) {
  const params = await _params;
  if (!isLocale(params.lang)) notFound();
  const lang = params.lang;
  const dict = await getDictionary(lang);

  const supabase = await createClient();

  const { data: series } = await supabase
    .from("series")
    .select("id, title, description, genre, language, status, cover_url, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

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

  // Only finished books: every episode published, nothing still running.
  const completed = seriesList.filter((s) => (counts.get(s.id) ?? 0) >= EPISODES_PER_SERIAL);

  const t = dict.downloads as Record<string, string>;
  const ts = dict.series as Record<string, string>;
  const storageBase = `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "")}/storage/v1/object/public/books`;

  const isEnglish = (s: SeriesRow) => (s.language ?? "").toLowerCase().startsWith("en");
  const groups: { key: string; heading: string; items: SeriesRow[] }[] = [
    { key: "ur", heading: ts.urduSection, items: completed.filter((s) => !isEnglish(s)) },
    { key: "en", heading: ts.englishSection, items: completed.filter(isEnglish) },
  ];

  return (
    <div className="bg-gradient-to-b from-indigo-50 via-white to-amber-50 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-extrabold text-indigo-800 sm:text-5xl dark:text-indigo-300">{t.title}</h1>
          <p className="mt-3 text-lg text-neutral-600 dark:text-neutral-300">{t.subtitle}</p>
        </div>

        {completed.length === 0 ? (
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
                  {g.items.map((s) => {
                    const pdfUrl = `${storageBase}/${s.id}.pdf`;
                    const downloadUrl = `${pdfUrl}?download=nazmhub-book-${s.id.slice(0, 8)}.pdf`;
                    return (
                      <div
                        key={s.id}
                        className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
                      >
                        {s.cover_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.cover_url} alt={s.title} className="aspect-[16/9] w-full object-cover" loading="lazy" />
                        )}
                        <div className="p-6">
                          <div className="flex items-start justify-between gap-2">
                            <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
                              {s.genre ?? "—"}
                            </span>
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                              {t.badge}
                            </span>
                          </div>
                          <h3 className="mt-3 text-xl font-bold leading-snug">{s.title}</h3>
                          {s.description && (
                            <p className="mt-2 line-clamp-3 text-sm text-neutral-600 dark:text-neutral-300">{s.description}</p>
                          )}
                          <p className="mt-4 text-sm font-medium text-neutral-500">
                            {counts.get(s.id) ?? 0} {ts.episodes}
                          </p>
                          <div className="mt-5 flex flex-wrap gap-3">
                            <Link href={`/series/${s.id}`}>
                              <Button variant="secondary">📖 {t.readOnline}</Button>
                            </Link>
                            <a href={downloadUrl}>
                              <Button>⬇ {t.downloadPdf}</Button>
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
        )}
      </div>
    </div>
  );
}
