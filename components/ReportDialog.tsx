"use client";

import { useState } from "react";
import type { Locale } from "@/lib/site-config";
import type { Dictionary } from "@/lib/i18n/types";
import { Button } from "./ui/Button";

/**
 * Report dialog. Open to ANY signed-in user, including kids — reporting an
 * inappropriate story must never be gated behind age. Uses the Phase 1
 * `moderation.*` strings where they exist, plus social additions.
 */
interface ReportDialogProps {
  postId: string;
  lang: Locale;
  dict: Dictionary;
  signedIn: boolean;
}

export function ReportDialog({ postId, lang, dict, signedIn }: ReportDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  if (!signedIn) return null;

  const submit = async () => {
    if (reason.trim().length < 3 || state === "sending") return;
    setState("sending");
    try {
      const res = await fetch(`/${lang}/api/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: postId, reason: reason.trim(), details: details.trim() || undefined }),
      });
      if (!res.ok) throw new Error("failed");
      setState("done");
    } catch {
      setState("error");
    }
  };

  const close = () => {
    setOpen(false);
    setState("idle");
    setReason("");
    setDetails("");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
      >
        <span aria-hidden>⚑</span> {dict.social.report}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={dict.social.reportTitle}
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            {state === "done" ? (
              <div className="text-center">
                <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">✓</p>
                <p className="mt-2 text-neutral-700 dark:text-neutral-200">{dict.social.reportSuccess}</p>
                <Button className="mt-4" onClick={close}>
                  {dict.common.close}
                </Button>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold">{dict.social.reportTitle}</h2>
                <label className="mt-4 block text-sm font-medium">
                  {dict.social.reportReason}
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={dict.social.reportReasonPlaceholder}
                    maxLength={120}
                    className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                  />
                </label>
                <label className="mt-3 block text-sm font-medium">
                  {dict.social.reportDetails}
                  <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder={dict.social.reportDetailsPlaceholder}
                    rows={3}
                    maxLength={2000}
                    className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                  />
                </label>
                {state === "error" && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">{dict.social.reportError}</p>
                )}
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="ghost" onClick={close}>
                    {dict.common.cancel}
                  </Button>
                  <Button onClick={submit} loading={state === "sending"} disabled={reason.trim().length < 3}>
                    {dict.social.submitReport}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
