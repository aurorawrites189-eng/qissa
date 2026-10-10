/**
 * /[lang]/admin/users?q= — search users, suspend/unsuspend, toggle admin,
 * see strike counts. The admin's own row has no action buttons.
 */
import { requireAdminPage } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/site-config";
import { UsersTable, type AdminUser } from "@/components/admin/UsersTable";

export default async function AdminUsersPage({
  params: _params,
  searchParams: _searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await _params;
  const searchParams = await _searchParams;
  const lang = params.lang as Locale;
  const { user } = await requireAdminPage(lang);
  const dict = await getDictionary(lang);
  const t = dict.admin.users;
  const q = (searchParams.q ?? "").trim();

  const admin = createAdminClient();
  let query = admin
    .from("profiles")
    .select("id, username, display_name, age_class, is_admin, strike_count, is_suspended, suspended_until, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (q) {
    const like = `%${q}%`;
    query = query.or(`username.ilike.${like},display_name.ilike.${like}`);
  }
  const { data } = await query;

  return (
    <div>
      <h1 className="text-2xl font-extrabold">{t.title}</h1>
      <form method="GET" className="mt-4 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={t.searchPlaceholder}
          className="w-full max-w-sm rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          type="submit"
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 dark:bg-emerald-600"
        >
          {t.search}
        </button>
      </form>
      <div className="mt-6">
        <UsersTable lang={lang} dict={dict} users={(data ?? []) as AdminUser[]} selfId={user.id} />
      </div>
    </div>
  );
}
