"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/site-config";
import type { Dictionary } from "@/lib/i18n/types";
import { Button } from "../ui/Button";

export interface AdminUser {
  id: string;
  username: string;
  display_name: string | null;
  age_class: "child" | "adult" | null;
  is_admin: boolean;
  strike_count: number;
  is_suspended: boolean;
  suspended_until: string | null;
  created_at: string;
}

/** Users table with suspend/unsuspend + admin toggle actions. */
export function UsersTable({ lang, dict, users, selfId }: { lang: Locale; dict: Dictionary; users: AdminUser[]; selfId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const t = dict.admin.users;

  const act = async (user: AdminUser, action: "suspend" | "unsuspend" | "make_admin" | "remove_admin") => {
    if (action === "suspend" && !window.confirm(t.confirmSuspend)) return;
    setBusy(`${user.id}:${action}`);
    try {
      const res = await fetch(`/${lang}/api/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, userId: user.id }),
      });
      if (!res.ok) throw new Error("failed");
      router.refresh();
    } catch {
      /* surface via refresh state; keep simple */
    } finally {
      setBusy(null);
    }
  };

  if (users.length === 0) {
    return <p className="rounded-2xl border border-dashed p-8 text-center text-neutral-500">{t.empty}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-neutral-50 dark:bg-neutral-900">
          <tr>
            <th className="px-4 py-3 font-semibold">{t.title}</th>
            <th className="px-4 py-3 font-semibold">{t.strikes}</th>
            <th className="px-4 py-3 font-semibold">{t.suspended}</th>
            <th className="px-4 py-3 font-semibold">{t.roleAdmin}</th>
            <th className="px-4 py-3 font-semibold">{dict.common.edit}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t border-neutral-200 dark:border-neutral-800">
              <td className="px-4 py-3">
                <p className="font-medium">@{u.username}</p>
                <p className="text-xs text-neutral-500">
                  {u.age_class === "child" ? t.roleChild : t.roleAdult}
                  {u.display_name ? ` · ${u.display_name}` : ""}
                </p>
              </td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${u.strike_count >= 2 ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"}`}>
                  {u.strike_count}
                </span>
              </td>
              <td className="px-4 py-3 text-xs">
                {u.is_suspended ? (
                  <span className="text-red-700 dark:text-red-300">
                    {t.suspended}
                    {u.suspended_until && ` ${t.until} ${new Date(u.suspended_until).toLocaleDateString(lang)}`}
                  </span>
                ) : (
                  <span className="text-neutral-400">—</span>
                )}
              </td>
              <td className="px-4 py-3">{u.is_admin ? <span aria-label={t.roleAdmin}>✓</span> : <span className="text-neutral-300">—</span>}</td>
              <td className="px-4 py-3">
                {u.id === selfId ? (
                  <span className="text-xs text-neutral-400">—</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {u.is_suspended ? (
                      <Button variant="secondary" onClick={() => act(u, "unsuspend")} loading={busy === `${u.id}:unsuspend`}>
                        {t.unsuspend}
                      </Button>
                    ) : (
                      <Button variant="danger" onClick={() => act(u, "suspend")} loading={busy === `${u.id}:suspend`}>
                        {t.suspend}
                      </Button>
                    )}
                    {u.is_admin ? (
                      <Button variant="secondary" onClick={() => act(u, "remove_admin")} loading={busy === `${u.id}:remove_admin`}>
                        {t.removeAdmin}
                      </Button>
                    ) : (
                      <Button variant="secondary" onClick={() => act(u, "make_admin")} loading={busy === `${u.id}:make_admin`}>
                        {t.makeAdmin}
                      </Button>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
