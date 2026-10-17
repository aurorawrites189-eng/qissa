"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/site-config";
import type { Dictionary } from "@/lib/i18n/types";
import { Button } from "../ui/Button";
import type { QueueItem } from "@/lib/admin-queries";

export type ModerationKind = "posts" | "kids" | "reports" | "originality";

interface ModerationTableProps {
  lang: Locale;
  dict: Dictionary;
  kind: ModerationKind;
  items: QueueItem[];
}

/**
 * Client table for admin queues. Renders per-kind columns and action
 * buttons; actions POST to /api/admin/moderation and refresh the page.
 * A reason is optional for approvals, required for rejections/withholds.
 */
export function ModerationTable({ lang, dict, kind, items }: ModerationTableProps) {
  const router = useRouter();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = dict.admin.moderation;

  const act = async (item: QueueItem, action: string) => {
    const reason = (reasons[item.id] ?? "").trim();
    if ((action === "reject" || action === "withhold") && !reason) {
      setError(t.reasonLabel);
      return;
    }
    setBusy(`${item.id}:${action}`);
    setError(null);
    try {
      const res = await fetch(`/api/admin/moderation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          targetType: kind === "reports" ? "report" : "post",
          targetId: item.id,
          reason: reason || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "failed");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(null);
    }
  };

  if (items.length === 0) {
    return <p className="rounded-2xl border border-dashed p-8 text-center text-neutral-500">{t.empty}</p>;
  }

  const actionsFor = (item: QueueItem) => {
    if (kind === "reports") {
      return (
        <>
          <Button variant="secondary" onClick={() => act(item, "dismiss")} loading={busy === `${item.id}:dismiss`}>
            {t.dismiss}
          </Button>
          <Button variant="danger" onClick={() => act(item, "uphold")} loading={busy === `${item.id}:uphold`}>
            {t.uphold}
          </Button>
        </>
      );
    }
    if (kind === "kids") {
      return (
        <>
          <Button onClick={() => act(item, "approve_kids")} loading={busy === `${item.id}:approve_kids`}>
            {t.approveKids}
          </Button>
          <Button variant="danger" onClick={() => act(item, "reject")} loading={busy === `${item.id}:reject`}>
            {t.reject}
          </Button>
        </>
      );
    }
    return (
      <>
        <Button onClick={() => act(item, "approve")} loading={busy === `${item.id}:approve`}>
          {t.approve}
        </Button>
        <Button variant="secondary" onClick={() => act(item, "withhold")} loading={busy === `${item.id}:withhold`}>
          {t.withhold}
        </Button>
        <Button variant="danger" onClick={() => act(item, "reject")} loading={busy === `${item.id}:reject`}>
          {t.reject}
        </Button>
      </>
    );
  };

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
      {items.map((item) => (
        <div key={item.id} className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              {kind === "reports" ? (
                <>
                  <p className="font-semibold">
                    {t.story}:{" "}
                    {item.post ? (
                      <Link href={`/posts/${item.post.id}`} className="text-emerald-700 hover:underline dark:text-emerald-400">
                        {item.post.title}
                      </Link>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </p>
                  <p className="mt-1 text-sm">
                    <span className="font-medium">{t.reportedBy}:</span> @{item.reporter?.username} — “{item.reason}”
                  </p>
                  {item.details && <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{item.details}</p>}
                </>
              ) : (
                <>
                  <Link href={`/posts/${item.id}`} className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
                    {item.title}
                  </Link>
                  <p className="text-sm text-neutral-500">
                    {dict.reader.by} @{item.author?.username}
                    {item.originality_status && (
                      <span className="ms-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        {(dict.admin.originalityStatus as Record<string, string>)[item.originality_status] ?? item.originality_status}
                      </span>
                    )}
                  </p>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-2">{actionsFor(item)}</div>
          </div>

          {kind === "originality" && item.originality_evidence && (
            <details className="mt-3 rounded-xl bg-neutral-50 p-3 text-sm dark:bg-neutral-800/60">
              <summary className="cursor-pointer font-medium">{t.viewEvidence}</summary>
              <p className="mt-2">
                {t.similarity}: <strong>{((item.originality_evidence.score ?? 0) * 100).toFixed(1)}%</strong>
                {" · "}corpus: {item.originality_evidence.corpusSize ?? "?"}
              </p>
              <ul className="mt-2 space-y-2">
                {(item.originality_evidence.matches ?? []).slice(0, 5).map((m) => (
                  <li key={m.postId} className="rounded-lg bg-white p-2 dark:bg-neutral-900">
                    <Link href={`/posts/${m.postId}`} className="font-medium hover:underline">
                      {m.title}
                    </Link>{" "}
                    <span className="text-neutral-500">({(m.score * 100).toFixed(1)}%)</span>
                    {m.exactMatches?.length > 0 && (
                      <ul className="mt-1 list-disc ps-5 text-neutral-600 dark:text-neutral-300">
                        {m.exactMatches.slice(0, 3).map((s, i) => (
                          <li key={i} dir="auto">
                            <code className="text-xs">…{s}…</code>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {kind !== "reports" && (
            <input
              type="text"
              value={reasons[item.id] ?? ""}
              onChange={(e) => setReasons((r) => ({ ...r, [item.id]: e.target.value }))}
              placeholder={t.reasonPlaceholder}
              aria-label={t.reasonLabel}
              className="mt-3 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            />
          )}
        </div>
      ))}
    </div>
  );
}
