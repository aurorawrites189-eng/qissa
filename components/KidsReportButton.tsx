"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { reportSchema } from "@/lib/validation";
import { Button } from "./ui/Button";
import { Textarea } from "./ui/Textarea";

interface ReportLabels {
  reportStory: string;
  reportReason: string;
  reportDetails: string;
  submitReport: string;
  cancel: string;
  reportSent: string;
  reportLogin: string;
  reasonInappropriate: string;
  reasonScary: string;
  reasonOther: string;
}

/**
 * Report button for the kids' reader. Inserts directly into `reports` —
 * the RLS policy `reports_insert_own` allows any signed-in user (including
 * children) to report with reporter_id = auth.uid().
 */
export function KidsReportButton({
  lang,
  postId,
  labels,
}: {
  lang: string;
  postId: string;
  labels: ReportLabels;
}) {
  const [userId, setUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("inappropriate");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  if (userId === null) {
    return (
      <Link
        href={`/${lang}/auth/login`}
        className="text-sm text-neutral-500 underline hover:text-neutral-700 dark:text-neutral-400"
      >
        {labels.reportLogin}
      </Link>
    );
  }

  if (sent) {
    return (
      <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
        {labels.reportSent}
      </p>
    );
  }

  if (!open) {
    return (
      <Button variant="ghost" onClick={() => setOpen(true)} className="text-sm">
        {labels.reportStory}
      </Button>
    );
  }

  const reasonLabel =
    reason === "inappropriate"
      ? labels.reasonInappropriate
      : reason === "scary"
        ? labels.reasonScary
        : labels.reasonOther;

  const submit = async () => {
    setSending(true);
    setError(false);
    const parsed = reportSchema.safeParse({
      post_id: postId,
      reason: reasonLabel,
      details: details.trim() || undefined,
    });
    if (!parsed.success) {
      setError(true);
      setSending(false);
      return;
    }
    const { error: insertError } = await createClient().from("reports").insert({
      reporter_id: userId,
      post_id: parsed.data.post_id,
      reason: parsed.data.reason,
      details: parsed.data.details ?? null,
    });
    setSending(false);
    if (insertError) setError(true);
    else setSent(true);
  };

  return (
    <div className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-700">
      <label className="mb-1 block text-sm font-medium">{labels.reportReason}</label>
      <select
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="mb-3 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      >
        <option value="inappropriate">{labels.reasonInappropriate}</option>
        <option value="scary">{labels.reasonScary}</option>
        <option value="other">{labels.reasonOther}</option>
      </select>
      <Textarea
        label={labels.reportDetails}
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        rows={3}
        maxLength={2000}
      />
      {error && <p className="mt-2 text-sm text-red-600">⚠</p>}
      <div className="mt-3 flex gap-2">
        <Button onClick={submit} loading={sending}>
          {labels.submitReport}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          {labels.cancel}
        </Button>
      </div>
    </div>
  );
}
