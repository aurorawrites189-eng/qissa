/**
 * /[lang]/admin/audit — moderation_actions log (admin only, read-only).
 */
import { requireAdminPage } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/site-config";

export default async function AuditLogPage({ params }: { params: { lang: string } }) {
  const lang = params.lang as Locale;
  await requireAdminPage(lang);
  const dict = await getDictionary(lang);
  const t = dict.admin.audit;

  const admin = createAdminClient();
  const { data: actions } = await admin
    .from("moderation_actions")
    .select("id, admin_id, target_type, target_id, action, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const adminIds = [...new Set((actions ?? []).map((a) => a.admin_id).filter((x): x is string => !!x))];
  const { data: admins } = adminIds.length
    ? await admin.from("public_profiles").select("id, username").in("id", adminIds)
    : { data: [] as Array<{ id: string; username: string }> };
  const adminMap = new Map((admins ?? []).map((a) => [a.id, a.username]));

  return (
    <div>
      <h1 className="text-2xl font-extrabold">{t.title}</h1>
      <div className="mt-6 overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
        {(actions ?? []).length === 0 ? (
          <p className="p-8 text-center text-neutral-500">{t.empty}</p>
        ) : (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-3 font-semibold">{t.date}</th>
                <th className="px-4 py-3 font-semibold">{t.admin}</th>
                <th className="px-4 py-3 font-semibold">{t.action}</th>
                <th className="px-4 py-3 font-semibold">{t.target}</th>
                <th className="px-4 py-3 font-semibold">{t.reason}</th>
              </tr>
            </thead>
            <tbody>
              {(actions ?? []).map((a) => (
                <tr key={a.id} className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-neutral-500">
                    {new Date(a.created_at).toLocaleString(lang)}
                  </td>
                  <td className="px-4 py-3">@{a.admin_id ? adminMap.get(a.admin_id) ?? "?" : "—"}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium dark:bg-neutral-800">
                      {a.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-500">
                    {a.target_type}
                    {a.target_id ? ` · ${String(a.target_id).slice(0, 8)}…` : ""}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-neutral-600 dark:text-neutral-300">
                    {a.reason ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
