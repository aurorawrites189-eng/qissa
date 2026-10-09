/**
 * /[lang]/admin — dashboard with stat cards linking into each queue.
 */
import { requireAdminPage } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/server";
import { getDashboardStats } from "@/lib/admin-queries";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/site-config";
import { StatCard } from "@/components/admin/StatCard";

export default async function AdminDashboardPage({ params }: { params: { lang: string } }) {
  const lang = params.lang as Locale;
  await requireAdminPage(lang);
  const dict = await getDictionary(lang);
  const stats = await getDashboardStats(createAdminClient());
  const t = dict.admin.dashboard;

  return (
    <div>
      <h1 className="text-2xl font-extrabold">{t.title}</h1>
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard label={t.users} value={stats.users} href={`/${lang}/admin/users`} accent="sky" />
        <StatCard label={t.stories} value={stats.stories} accent="neutral" />
        <StatCard label={t.pendingReview} value={stats.pendingReview} href={`/${lang}/admin/moderation?tab=posts`} accent="amber" />
        <StatCard label={t.openReports} value={stats.openReports} href={`/${lang}/admin/moderation?tab=reports`} accent="red" />
        <StatCard label={t.kidsQueue} value={stats.kidsQueue} href={`/${lang}/admin/kids`} accent="emerald" />
        <StatCard label={t.openAppeals} value={stats.openAppeals} href={`/${lang}/admin/appeals`} accent="violet" />
      </div>
    </div>
  );
}
