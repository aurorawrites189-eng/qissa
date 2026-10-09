/**
 * /[lang]/admin/appeals — decide open appeals (overturn/uphold).
 * Overturning removes the strike and lifts strike-driven suspensions.
 */
import { requireAdminPage } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/site-config";
import { AppealsTable, type AppealItem } from "@/components/admin/AppealsTable";

export default async function AdminAppealsPage({ params }: { params: { lang: string } }) {
  const lang = params.lang as Locale;
  await requireAdminPage(lang);
  const dict = await getDictionary(lang);
  const t = dict.admin.appeals;

  const admin = createAdminClient();
  const { data: appeals } = await admin
    .from("appeals")
    .select("id, message, created_at, violation_id, user_id")
    .eq("status", "open")
    .order("created_at", { ascending: true })
    .limit(100);

  const violationIds = [...new Set((appeals ?? []).map((a) => a.violation_id))];
  const userIds = [...new Set((appeals ?? []).map((a) => a.user_id))];
  const [{ data: violations }, { data: users }] = await Promise.all([
    violationIds.length
      ? admin.from("violations").select("id, type, status, post_id").in("id", violationIds)
      : Promise.resolve({ data: [] as Array<{ id: string; type: string; status: string; post_id: string | null }> }),
    userIds.length
      ? admin.from("profiles").select("id, username, strike_count").in("id", userIds)
      : Promise.resolve({ data: [] as Array<{ id: string; username: string; strike_count: number }> }),
  ]);
  const violationMap = new Map((violations ?? []).map((v) => [v.id, v]));
  const userMap = new Map((users ?? []).map((u) => [u.id, u]));

  const items: AppealItem[] = (appeals ?? []).map((a) => ({
    id: a.id,
    message: a.message,
    created_at: a.created_at,
    violation: violationMap.get(a.violation_id) ?? null,
    user: userMap.get(a.user_id) ?? null,
  }));

  return (
    <div>
      <h1 className="text-2xl font-extrabold">{t.title}</h1>
      <div className="mt-6">
        <AppealsTable lang={lang} dict={dict} appeals={items} />
      </div>
    </div>
  );
}
