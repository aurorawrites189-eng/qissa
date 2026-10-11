import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isLocale } from "@/lib/i18n/config";
import { Button } from "@/components/ui/Button";

async function createEpisode(seriesId: string, formData: FormData) {
  "use server";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Only the series author may add episodes.
  const { data: s } = await supabase
    .from("series")
    .select("id, author_id, language")
    .eq("id", seriesId)
    .maybeSingle();
  if (!s || (s as { author_id: string | null }).author_id !== user.id) return;

  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  const content = String(formData.get("content") ?? "").trim();
  if (title.length < 3 || content.length < 100) return;

  const { data: existing } = await supabase
    .from("posts")
    .select("episode_number")
    .eq("series_id", seriesId)
    .order("episode_number", { ascending: false })
    .limit(1);
  const nextNum =
    ((existing ?? []) as { episode_number: number | null }[]).reduce(
      (m, e) => Math.max(m, e.episode_number ?? 0),
      0
    ) + 1;

  const { error } = await supabase.from("posts").insert({
    author_id: user.id,
    title,
    content,
    language: (s as { language: string }).language ?? "ur",
    category: "serial",
    tags: ["serial"],
    status: "published",
    visibility: "public",
    moderation_status: "approved",
    is_kids_approved: false,
    published_at: new Date().toISOString(),
    series_id: seriesId,
    episode_number: nextNum,
  });
  if (!error) redirect(`/ur/series/${seriesId}/${nextNum}`);
}

/**
 * Add an episode: /[lang]/series/[seriesId]/new (series author only).
 */
export default async function NewEpisodePage({
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
  if (!user) redirect(`/${lang}/login`);

  const { data: s } = await supabase
    .from("series")
    .select("id, title, author_id")
    .eq("id", params.seriesId)
    .maybeSingle();
  if (!s || (s as { author_id: string | null }).author_id !== user.id) notFound();

  const t = dict.series as Record<string, string>;
  const create = createEpisode.bind(null, params.seriesId);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-extrabold">{t.newEpisodeTitle}</h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-300">
        {(s as { title: string }).title}
      </p>
      <form action={create} className="mt-6 space-y-5">
        <div>
          <label htmlFor="title" className="mb-1 block text-sm font-medium">
            {t.episodeTitle}
          </label>
          <input
            id="title"
            name="title"
            required
            minLength={3}
            maxLength={200}
            className="w-full rounded-xl border border-neutral-300 px-4 py-2.5 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </div>
        <div>
          <label htmlFor="content" className="mb-1 block text-sm font-medium">
            {t.content}
          </label>
          <textarea
            id="content"
            name="content"
            required
            rows={14}
            minLength={100}
            className="w-full rounded-xl border border-neutral-300 px-4 py-2.5 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </div>
        <Button type="submit">{t.publish}</Button>
      </form>
    </div>
  );
}
