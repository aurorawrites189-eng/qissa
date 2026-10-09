/**
 * /[lang]/admin/moderation?tab=posts|reports|originality
 * Human review queues: pending stories, open reports, originality holds.
 * (Kids approvals live on the dedicated /admin/kids page.)
 */
import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/server";
import { getModerationQueue, type ModerationQueue } from "@/lib/admin-queries";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/site-config";
import { ModerationTable } from "@/components/admin/ModerationTable";

const TABS: ModerationQueue[] = ["posts", "reports", "originality"];

export default async function ModerationPage({
  params,
  searchParams,
}: {
  params: { lang: string };
  searchParams: { tab?: string };
}) {
  const lang = params.lang as Locale;
  await requireAdminPage(lang);
  const dict = await getDictionary(lang);
  const t = dict.admin.moderation;

  const tab: ModerationQueue = TABS.includes(searchParams.tab as ModerationQueue)
    ? (searchParams.tab as ModerationQueue)
    : "posts";
  const items = await getModerationQueue(createAdminClient(), tab);

  const tabLabels: Record<ModerationQueue, string> = {
    posts: t.tabPosts,
    reports: t.tabReports,
    kids: t.tabPosts,
    originality: t.tabOriginality,
  };

  return (
    <div>
      <h1 className="text-2xl font-extrabold">{t.title}</h1>
      <div className="mt-4 flex gap-1 border-b border-neutral-200 dark:border-neutral-800" role="tablist">
        {TABS.map((q) => (
          <Link
            key={q}
            href={`/${lang}/admin/moderation?tab=${q}`}
            role="tab"
            aria-selected={tab === q}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
              tab === q
                ? "border-b-2 border-emerald-600 text-emerald-700 dark:text-emerald-400"
                : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400"
            }`}
          >
            {tabLabels[q]}
          </Link>
        ))}
      </div>
      <div className="mt-6">
        <ModerationTable lang={lang} dict={dict} kind={tab} items={items} />
      </div>
    </div>
  );
}
