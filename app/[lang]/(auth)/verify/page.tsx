"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { resendVerificationAction } from "../actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function VerifyPage() {
  const { locale, dict } = useLanguage();
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  const onResend = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    try {
      // Resend via Route Handler (JSON) — see login page for why.
      await fetch(`/api/auth/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, lang: locale }),
      });
      setDone(true);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12 text-center">
      <h1 className="text-2xl font-bold">{dict.auth.verifyTitle}</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
        {dict.auth.verifyBody}
      </p>

      <div className="mt-8 rounded-2xl border border-neutral-200 p-6 text-start dark:border-neutral-800">
        {done ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            {dict.auth.resendDone}
          </p>
        ) : (
          <form onSubmit={onResend} className="flex flex-col gap-3">
            <Input
              name="email"
              type="email"
              required
              label={dict.auth.email}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" loading={pending} variant="secondary">
              {dict.auth.resendButton}
            </Button>
          </form>
        )}
      </div>

      <Link
        href={`/login`}
        className="mt-6 inline-block text-sm text-emerald-700 hover:underline dark:text-emerald-400"
      >
        {dict.auth.backToLogin}
      </Link>
    </div>
  );
}
