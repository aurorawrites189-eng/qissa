/**
 * /[lang]/admin/kids — approve published stories for the kids section.
 * Approving sets is_kids_approved=true (and keeps/sets published status).
 */
import { requireAdminPage } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/server";
import { getModerationQueue } from "@/lib/admin-queries";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/site-config";
import { ModerationTable } from "@/components/admin/ModerationTable";

export default async function KidsApprovalsPage({ params }: { params: { lang: string } }) {
  const lang = params.lang as Locale;
  await requireAdminPage(lang);
  const dict = await getDictionary(lang);
  const t = dict.admin.kids;

  const items = await getModerationQueue(createAdminClient(), "kids");

  return (
    <div>
      <h1 className="text-2xl font-extrabold">{t.title}</h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{t.subtitle}</p>
      <div className="mt-6">
        <ModerationTable lang={lang} dict={dict} kind="kids" items={items} />
      </div>
    </div>
  );
}
