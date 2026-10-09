"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { createClient } from "@/lib/supabase/client";
import { requestPasswordResetAction, updatePasswordAction } from "../actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

/**
 * Two modes in one page:
 * - "request": ask for the email, send the reset link.
 * - "set": shown when an active (recovery) session exists — the user picks
 *   a new password. The auth callback redirects here after code exchange.
 */
export default function ResetPasswordPage() {
  const { locale, dict } = useLanguage();
  const [mode, setMode] = useState<"request" | "set">("request");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (data.session) setMode("set");
      });
  }, []);

  const onRequest = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const formData = new FormData(e.currentTarget);
      formData.set("lang", locale);
      const result = await requestPasswordResetAction(formData);
      if (result?.error) setError(result.error);
      else setDone(true);
    } catch {
      setError(dict.validation.genericError);
    } finally {
      setPending(false);
    }
  };

  const onSet = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const formData = new FormData(e.currentTarget);
      formData.set("lang", locale);
      const result = await updatePasswordAction(formData);
      if (result?.error) setError(result.error);
      else setDone(true);
    } catch {
      setError(dict.validation.genericError);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      {mode === "request" ? (
        <>
          <h1 className="text-2xl font-bold">{dict.auth.resetTitle}</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {dict.auth.resetBody}
          </p>
          {done ? (
            <p className="mt-6 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              {dict.auth.resetDone}
            </p>
          ) : (
            <form onSubmit={onRequest} className="mt-6 flex flex-col gap-4">
              <Input name="email" type="email" required label={dict.auth.email} />
              {error && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}
              <Button type="submit" loading={pending}>
                {dict.auth.resetButton}
              </Button>
            </form>
          )}
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold">{dict.auth.setNewPasswordTitle}</h1>
          {done ? (
            <div className="mt-6">
              <p className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                {dict.auth.passwordUpdated}
              </p>
              <Link
                href={`/${locale}/auth/login`}
                className="mt-4 inline-block text-sm text-emerald-700 hover:underline dark:text-emerald-400"
              >
                {dict.auth.backToLogin}
              </Link>
            </div>
          ) : (
            <form onSubmit={onSet} className="mt-6 flex flex-col gap-4">
              <Input
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                label={dict.auth.newPassword}
              />
              <Input
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                label={dict.auth.confirmPassword}
              />
              {error && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}
              <Button type="submit" loading={pending}>
                {dict.auth.setNewPasswordButton}
              </Button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
