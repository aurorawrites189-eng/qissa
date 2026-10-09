"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export interface DashboardNotification {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationsLabels {
  markAllRead: string;
  noNotifications: string;
}

/**
 * Render a human-readable line for a notification. Payloads are produced by
 * server-side moderation flows (Phase 3); unknown types fall back to the
 * raw type string so nothing is ever blank.
 */
function describe(n: DashboardNotification): string {
  const p = n.payload ?? {};
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  switch (n.type) {
    case "post_published":
      return `“${str(p.title) || "your story"}” is now published.`;
    case "post_withheld":
      return `“${str(p.title) || "your story"}” was withheld by moderators.${str(p.reason) ? ` Reason: ${str(p.reason)}` : ""}`;
    case "post_pending_review":
      return `“${str(p.title) || "your story"}” is in the review queue.`;
    case "violation":
      return `A violation was recorded on your account.${str(p.type) ? ` Type: ${str(p.type)}` : ""}`;
    case "appeal_decided":
      return `Your appeal was decided: ${str(p.decision) || "see details"}.`;
    case "new_follower":
      return `${str(p.username) || "Someone"} started following you.`;
    default:
      return n.type.replace(/_/g, " ");
  }
}

/** Notifications with mark-read. RLS allows owner-only updates. */
export function NotificationsList({
  initial,
  labels,
}: {
  initial: DashboardNotification[];
  labels: NotificationsLabels;
}) {
  const [items, setItems] = useState(initial);
  const [working, setWorking] = useState(false);

  const markRead = async (ids: string[]) => {
    if (ids.length === 0) return;
    setWorking(true);
    const { error } = await createClient()
      .from("notifications")
      .update({ is_read: true })
      .in("id", ids);
    setWorking(false);
    if (!error) {
      setItems((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n)));
    }
  };

  const unread = items.filter((n) => !n.is_read);

  if (items.length === 0) {
    return <p className="text-sm text-neutral-500">{labels.noNotifications}</p>;
  }

  return (
    <div>
      {unread.length > 0 && (
        <div className="mb-3">
          <Button
            variant="secondary"
            onClick={() => void markRead(unread.map((n) => n.id))}
            loading={working}
          >
            {labels.markAllRead}
          </Button>
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {items.map((n) => (
          <li
            key={n.id}
            className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
              n.is_read
                ? "border-neutral-200 dark:border-neutral-800"
                : "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20"
            }`}
          >
            <div>
              <p className={n.is_read ? "text-neutral-600 dark:text-neutral-300" : "font-medium"}>
                {describe(n)}
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                {new Date(n.created_at).toLocaleString()}
              </p>
            </div>
            {!n.is_read && (
              <button
                type="button"
                onClick={() => void markRead([n.id])}
                className="shrink-0 text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
              >
                ✓
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
