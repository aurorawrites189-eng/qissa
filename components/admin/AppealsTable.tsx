"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/site-config";
import type { Dictionary } from "@/lib/i18n/types";
import { Button } from "../ui/Button";

export interface AppealItem {
  id: string;
  message: string;
  created_at: string;
  violation: { id: string; type: string; status: string; post_id: string | null } | null;
  user: { id: string; username: string; strike_count: number } | null;
}

/** Open appeals with overturn/uphold decisions. */
export function AppealsTable({ lang, dict, appeals }: { lang: Locale; dict: Dictionary; appeals: AppealItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const t = dict.admin.appeals;

  const decide = async (appeal: AppealItem, overturn: boolean) => {
    setBusy(`${appeal.id}:${overturn}`);
    try {
      const res = await fetch(`/api/appeals`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appeal_id: appeal.id, overturn }),
      });
      if (!res.ok) throw new Error("failed");
      router.refresh();
    } catch {
      /* keep simple */
    } finally {
      setBusy(null);
    }
  };

  if (appeals.length === 0) {
    return <p className="rounded-2xl border border-dashed p-8 text-center text-neutral-500">{t.empty}</p>;
  }

  return (
    <div className="space-y-4">
      {appeals.map((a) => (
        <div key={a.id} className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-semibold">@{a.user?.username}</span>
                <span className="text-neutral-500"> · {t.violation}: {a.violation?.type} ({a.violation?.status})</span>
                {a.violation?.post_id && (
                  <Link href={`/posts/${a.violation.post_id}`} className="ms-2 text-emerald-700 hover:underline dark:text-emerald-400">
                    {dict.admin.moderation.story}
                  </Link>
                )}
              </p>
              <blockquote className="mt-2 rounded-xl bg-neutral-50 p-3 text-sm whitespace-pre-wrap dark:bg-neutral-800/60">
                {a.message}
              </blockquote>
              <p className="mt-1 text-xs text-neutral-400">
                {new Date(a.created_at).toLocaleString(lang)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => decide(a, true)} loading={busy === `${a.id}:true`}>
                {t.overturn}
              </Button>
              <Button variant="danger" onClick={() => decide(a, false)} loading={busy === `${a.id}:false`}>
                {t.uphold}
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
