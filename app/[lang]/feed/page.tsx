import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isLocale } from "@/lib/i18n/config";
import { PostCard, type PostCardPost } from "@/components/PostCard";
import { Pagination } from "@/components/Pagination";
import { FeedFilters } from "@/components/FeedFilters";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

const PAGE_SIZE = 12;

interface FeedSearchParams {
  lang?: string;
  category?: string;
  q?: string;
  page?: string;
}

/** Public story feed with language / category / text filters + pagination. */
export default async function FeedPage({
  params: _params,
  searchParams: _searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<FeedSearchParams>;
}) {
  const params = await _params;
  const searchParams = await _searchParams;
  if (!isLocale(params.lang)) notFound();
  const lang = params.lang;
  const dict = await getDictionary(lang);

  const filterLang = searchParams.lang === "en" || searchParams.lang === "ur" ? searchParams.lang : "";
  const filterCategory = searchParams.category?.trim() || "";
  const q = searchParams.q?.trim() || "";
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);

  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("slug, name_en, name_ur")
    .order("name_en");
  const catList = (categories ?? []) as { slug: string; name_en: string; name_ur: string }[];
  const catName = (slug: string | null) => {
    const c = catList.find((x) => x.slug === slug);
    return c ? (lang === "ur" ? c.name_ur : c.name_en) : null;
  };

  let query = supabase
    .from("posts")
    .select(
      "id, title, content, language, category, published_at, author_id, post_images(storage_path, alt_text)",
      { count: "exact" }
    )
    .eq("status", "published")
    .eq("visibility", "public")
    .order("published_at", { ascending: false });

  if (filterLang) query = query.eq("language", filterLang);
  if (filterCategory) query = query.eq("category", filterCategory);
  if (q) {
    // Strip LIKE wildcards AND postgrest filter-syntax chars (commas/parens
    // would break the .or() expression) before interpolating.
    const term = q.replace(/[%_(),]/g, "").trim();
    if (term) query = query.or(`title.ilike.%${term}%,content.ilike.%${term}%`);
  }

  const from = (page - 1) * PAGE_SIZE;
  const { data: posts, count } = await query.range(from, from + PAGE_SIZE - 1);
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const authorIds = [...new Set(((posts ?? []) as { author_id: string }[]).map((p) => p.author_id))];
  let authors: Record<string, { username: string; display_name: string | null; avatar_url: string | null }> = {};
  if (authorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("public_profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", authorIds);
    for (const p of profiles ?? []) {
      authors[p.id as string] = {
        username: p.username as string,
        display_name: (p.display_name as string | null) ?? null,
        avatar_url: (p.avatar_url as string | null) ?? null,
      };
    }
  }

  const cards: PostCardPost[] = ((posts ?? []) as Record<string, unknown>[]).map((p) => {
    const images = p.post_images as { storage_path: string; alt_text: string | null }[] | null;
    const content = p.content as string;
    return {
      id: p.id as string,
      title: p.title as string,
      language: p.language as string,
      excerpt: content.slice(0, 240) + (content.length > 240 ? "…" : ""),
      category: (p.category as string | null) ?? null,
      categoryName: catName((p.category as string | null) ?? null),
      published_at: (p.published_at as string | null) ?? null,
      wordCount: content.trim() === "" ? 0 : content.trim().split(/\s+/).length,
      author: authors[p.author_id as string] ?? null,
      cover: images?.[0]
        ? { storage_path: images[0].storage_path, alt_text: images[0].alt_text }
        : null,
    };
  });

  const hrefForPage = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (filterLang) sp.set("lang", filterLang);
    if (filterCategory) sp.set("category", filterCategory);
    sp.set("page", String(p));
    return `/${lang}/feed?${sp.toString()}`;
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">{dict.feed.title}</h1>
          <p className="mt-1 text-neutral-600 dark:text-neutral-300">{dict.feed.subtitle}</p>
        </div>
        <Link href={`/${lang}/write`}>
          <Button>{dict.nav.write}</Button>
        </Link>
      </div>

      <Suspense>
        <FeedFilters
          lang={lang}
          categories={catList}
          labels={{
            searchPlaceholder: dict.feed.searchPlaceholder,
            allLanguages: dict.feed.allLanguages,
            allCategories: dict.feed.allCategories,
            clearFilters: dict.feed.clearFilters,
            search: dict.common.search,
          }}
        />
      </Suspense>

      {cards.length === 0 ? (
        <EmptyState
          title={dict.feed.noResults}
          action={
            <Link href={`/${lang}/write`}>
              <Button>{dict.nav.write}</Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((post) => (
              <PostCard
                key={post.id}
                lang={lang}
                post={post}
                labels={{ by: dict.posts.by, words: dict.posts.words, readMore: dict.common.readMore }}
              />
            ))}
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            getHref={hrefForPage}
            labels={{
              previous: dict.pagination.previous,
              next: dict.pagination.next,
              page: dict.pagination.page,
              of: dict.pagination.of,
            }}
          />
        </>
      )}
    </div>
  );
}
