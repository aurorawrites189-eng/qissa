"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Locale } from "@/lib/site-config";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export interface FilterCategory {
  slug: string;
  name_en: string;
  name_ur: string;
}

interface FeedFiltersLabels {
  searchPlaceholder: string;
  allLanguages: string;
  allCategories: string;
  clearFilters: string;
  search: string;
}

/** Language / category / text filters that sync to the URL search params. */
export function FeedFilters({
  lang,
  categories,
  labels,
}: {
  lang: Locale;
  categories: FilterCategory[];
  labels: FeedFiltersLabels;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [language, setLanguage] = useState(searchParams.get("lang") ?? "");
  const [category, setCategory] = useState(searchParams.get("category") ?? "");

  // Keep the inputs in sync when the user navigates back/forward.
  useEffect(() => {
    setQ(searchParams.get("q") ?? "");
    setLanguage(searchParams.get("lang") ?? "");
    setCategory(searchParams.get("category") ?? "");
  }, [searchParams]);

  const apply = (next: { q: string; language: string; category: string }) => {
    const params = new URLSearchParams();
    if (next.q.trim()) params.set("q", next.q.trim());
    if (next.language) params.set("lang", next.language);
    if (next.category) params.set("category", next.category);
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  };

  // Debounced text search.
  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (q === current) return;
    const t = setTimeout(() => apply({ q, language, category }), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const selectClass =
    "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900";

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Input
          aria-label={labels.search}
          placeholder={labels.searchPlaceholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <select
        aria-label={labels.allLanguages}
        className={selectClass}
        value={language}
        onChange={(e) => {
          setLanguage(e.target.value);
          apply({ q, language: e.target.value, category });
        }}
      >
        <option value="">{labels.allLanguages}</option>
        <option value="en">English</option>
        <option value="ur">اردو</option>
      </select>
      <select
        aria-label={labels.allCategories}
        className={selectClass}
        value={category}
        onChange={(e) => {
          setCategory(e.target.value);
          apply({ q, language, category: e.target.value });
        }}
      >
        <option value="">{labels.allCategories}</option>
        {categories.map((c) => (
          <option key={c.slug} value={c.slug}>
            {lang === "ur" ? c.name_ur : c.name_en}
          </option>
        ))}
      </select>
      {(q || language || category) && (
        <Button variant="ghost" onClick={() => router.push(pathname)}>
          {labels.clearFilters}
        </Button>
      )}
    </div>
  );
}
