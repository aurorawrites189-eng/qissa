import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isLocale } from "@/lib/i18n/config";
import { KidsExplorer } from "@/components/KidsExplorer";
import type { KidsStory } from "@/components/KidsStoryCard";

interface RawPost {
  id: string;
  title: string;
  content: string;
  language: string;
  category: string | null;
  post_images: { storage_path: string; alt_text: string | null }[] | null;
}

async function toKidsStories(
  posts: RawPost[],
  catName: (slug: string | null) => string | null
): Promise<KidsStory[]> {
  return posts.map((p) => ({
    id: p.id,
    title: p.title,
    content: p.content,
    language: p.language,
    category: p.category,
    categoryName: catName(p.category),
    cover: p.post_images?.[0]
      ? { storage_path: p.post_images[0].storage_path, alt_text: p.post_images[0].alt_text }
      : null,
  }));
}

/**
 * Kids' Story World — colorful, kid-friendly story shelf.
 *
 * RLS guarantees a child account only ever sees kids-approved published
 * posts here, even though the query itself doesn't filter by viewer.
 */
export default async function KidsPage({ params: _params }: { params: Promise<{ lang: string }> }) {
  const params = await _params;
  if (!isLocale(params.lang)) notFound();
  const lang = params.lang;
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: categories } = await supabase
    .from("categories")
    .select("slug, name_en, name_ur")
    .eq("is_kids", true)
    .order("name_en");
  const catList = (categories ?? []) as { slug: string; name_en: string; name_ur: string }[];
  const catName = (slug: string | null) => {
    const c = catList.find((x) => x.slug === slug);
    return c ? (lang === "ur" ? c.name_ur : c.name_en) : null;
  };

  const { data: posts } = await supabase
    .from("posts")
    .select("id, title, content, language, category, post_images(storage_path, alt_text)")
    .eq("status", "published")
    .eq("is_kids_approved", true)
    .order("published_at", { ascending: false })
    .limit(60);
  const stories = await toKidsStories(((posts ?? []) as RawPost[]), catName);

  // "Continue reading" shelf from the reader's own history (owner-only RLS).
  let continueReading: KidsStory[] = [];
  if (user) {
    const { data: history } = await supabase
      .from("reading_history")
      .select("post_id")
      .eq("user_id", user.id)
      .order("last_read_at", { ascending: false })
      .limit(6);
    const ids = (history ?? []).map((h) => h.post_id as string);
    if (ids.length > 0) {
      const { data: recent } = await supabase
        .from("posts")
        .select("id, title, content, language, category, post_images(storage_path, alt_text)")
        .in("id", ids)
        .eq("status", "published")
        .eq("is_kids_approved", true);
      const byId = new Map(((recent ?? []) as RawPost[]).map((p) => [p.id, p]));
      const ordered = ids
        .map((id) => byId.get(id))
        .filter((p): p is RawPost => Boolean(p));
      continueReading = await toKidsStories(ordered, catName);
    }
  }

  return (
    <div className="bg-gradient-to-b from-violet-50 via-white to-amber-50 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-extrabold text-violet-800 sm:text-5xl dark:text-violet-300">
            {dict.kids.title}
          </h1>
          <p className="mt-3 text-lg text-neutral-600 dark:text-neutral-300">{dict.kids.subtitle}</p>
          <p className="mx-auto mt-3 w-fit rounded-full bg-emerald-100 px-4 py-1.5 text-sm font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
            {dict.kids.safeNotice}
          </p>
        </div>

        <KidsExplorer
          lang={lang}
          stories={stories}
          categories={catList.map((c) => ({
            slug: c.slug,
            name: lang === "ur" ? c.name_ur : c.name_en,
          }))}
          continueReading={continueReading}
          labels={{
            searchPlaceholder: dict.kids.searchPlaceholder,
            allStories: dict.kids.allStories,
            readStory: dict.kids.readStory,
            fontSize: dict.kids.fontSize,
            small: dict.kids.small,
            medium: dict.kids.medium,
            large: dict.kids.large,
            continueReading: dict.kids.continueReading,
            emptyTitle: dict.kids.emptyTitle,
            emptyBody: dict.kids.emptyBody,
          }}
        />
      </div>
    </div>
  );
}
