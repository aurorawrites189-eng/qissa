import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isLocale } from "@/lib/i18n/config";
import { Button } from "@/components/ui/Button";

async function createSeries(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  const description = String(formData.get("description") ?? "").trim().slice(0, 1000);
  const genre = String(formData.get("genre") ?? "").trim().slice(0, 50) || null;
  const language = formData.get("language") === "en" ? "en" : "ur";
  if (title.length < 3) return;

  const { data, error } = await supabase
    .from("series")
    .insert({ title, description: description || null, genre, language, author_id: user.id })
    .select("id")
    .single();
  if (!error && data) {
    const lang = language;
    redirect(`/series/${(data as { id: string }).id}`);
  }
}

/**
 * Start a new serial: /[lang]/series/new (login required).
 */
export default async function NewSeriesPage({ params: _params }: { params: Promise<{ lang: string }> }) {
  const params = await _params;
  if (!isLocale(params.lang)) notFound();
  const lang = params.lang;
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login`);

  const t = dict.series as Record<string, string>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-extrabold">{t.newSeriesTitle}</h1>
      <form action={createSeries} className="mt-6 space-y-5">
        <div>
          <label htmlFor="title" className="mb-1 block text-sm font-medium">
            {t.seriesTitle}
          </label>
          <input
            id="title"
            name="title"
            required
            minLength={3}
            maxLength={200}
            placeholder={t.seriesTitlePh}
            className="w-full rounded-xl border border-neutral-300 px-4 py-2.5 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </div>
        <div>
          <label htmlFor="description" className="mb-1 block text-sm font-medium">
            {t.description}
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            maxLength={1000}
            placeholder={t.descriptionPh}
            className="w-full rounded-xl border border-neutral-300 px-4 py-2.5 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="genre" className="mb-1 block text-sm font-medium">
              {t.genre}
            </label>
            <select
              id="genre"
              name="genre"
              className="w-full rounded-xl border border-neutral-300 px-4 py-2.5 dark:border-neutral-700 dark:bg-neutral-900"
            >
              <option value="mystery">Mystery / جاسوسی</option>
              <option value="adventure">Adventure / ایڈونچر</option>
              <option value="fantasy">Fantasy / فینٹسی</option>
              <option value="school">School drama / اسکول ڈرامہ</option>
              <option value="friendship">Friendship / دوستی</option>
              <option value="family">Family / خاندانی</option>
              <option value="romance">Romance / رومانوی</option>
            </select>
          </div>
          <div>
            <label htmlFor="language" className="mb-1 block text-sm font-medium">
              {t.language}
            </label>
            <select
              id="language"
              name="language"
              defaultValue={lang}
              className="w-full rounded-xl border border-neutral-300 px-4 py-2.5 dark:border-neutral-700 dark:bg-neutral-900"
            >
              <option value="ur">Urdu</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
        <Button type="submit">{t.create}</Button>
      </form>
    </div>
  );
}
