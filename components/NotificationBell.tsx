"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/site-config";
import type { Dictionary } from "@/lib/i18n/types";
import { fillTemplate } from "@/lib/format";

interface Notification {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationBellProps {
  lang: Locale;
  dict: Dictionary;
}

/** Render a human-readable line for a notification type + payload. */
function describe(n: Notification, dict: Dictionary): string {
  const templates = dict.notifications.types as unknown as Record<string, string>;
  const template = templates[n.type];
  if (!template) return n.type;
  const p = n.payload ?? {};
  const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? v : "");
  return fillTemplate(template, {
    title: str(p.title),
    username: str(p.followerUsername ?? p.commenterUsername ?? p.username),
    reason: str(p.reason),
    count: str(p.strikeCount),
    remaining: str(p.remaining),
    date: typeof p.until === "string" ? new Date(p.until).toLocaleDateString() : "",
  });
}

function storyLink(n: Notification, lang: Locale): string | null {
  const postId = n.payload?.postId;
  return typeof postId === "string" ? `/${lang}/posts/${postId}` : null;
}

/** Header bell: unread badge, dropdown list, mark-all-read. Polls every 60s. */
export function NotificationBell({ lang, dict }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/${lang}/api/notifications?limit=15`);
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.notifications ?? []);
      setUnread(data.unreadCount ?? 0);
    } catch {
      /* best-effort; the bell just stays quiet */
    }
  }, [lang]);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => {
      clearInterval(t);
      document.removeEventListener("mousedown", onClick);
    };
  }, [load]);

  const markAllRead = async () => {
    try {
      await fetch(`/${lang}/api/notifications`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      setItems((xs) => xs.map((x) => ({ ...x, is_read: true })));
      setUnread(0);
    } catch {
      /* ignore */
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={dict.notifications.title}
        aria-expanded={open}
        className="relative rounded-lg p-2 text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
      >
        <span aria-hidden className="text-lg">🔔</span>
        {unread > 0 && (
          <span className="absolute -top-0.5 -end-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 z-50 mt-2 w-80 max-w-[90vw] rounded-2xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
            <h2 className="text-sm font-bold">{dict.notifications.title}</h2>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
              >
                {dict.notifications.markAllRead}
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-neutral-500">{dict.notifications.empty}</li>
            )}
            {items.map((n) => {
              const link = storyLink(n, lang);
              const body = (
                <>
                  <p className={`text-sm ${n.is_read ? "text-neutral-600 dark:text-neutral-300" : "font-medium text-neutral-900 dark:text-neutral-100"}`}>
                    {describe(n, dict)}
                  </p>
                  <time className="text-xs text-neutral-400" dateTime={n.created_at}>
                    {new Date(n.created_at).toLocaleString(lang)}
                  </time>
                </>
              );
              return (
                <li key={n.id} className={`border-b border-neutral-100 px-4 py-3 last:border-0 dark:border-neutral-800 ${n.is_read ? "" : "bg-emerald-50/60 dark:bg-emerald-950/20"}`}>
                  {link ? (
                    <Link href={link} onClick={() => setOpen(false)} className="block">
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
