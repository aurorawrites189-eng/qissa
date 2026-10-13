"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function LoginPage() {
  const { locale, dict } = useLanguage();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const formData = new FormData(e.currentTarget);
      // Login via Route Handler (JSON): the Server Action transport is
      // unreliable on this deployment, so auth uses plain HTTP instead.
      const res = await fetch(`/${locale}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password"),
          lang: locale,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        dest?: string;
        error?: string;
        fieldErrors?: Record<string, string[] | undefined>;
      };
      if (!res.ok || data.error) {
        setError(data.error ?? dict.validation.genericError);
      } else if (data.dest) {
        router.push(data.dest);
        router.refresh();
      }
    } catch {
      setError(dict.validation.genericError);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-bold">{dict.auth.loginTitle}</h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        {dict.auth.loginSubtitle}
      </p>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        <Input
          name="email"
          type="email"
          autoComplete="email"
          required
          label={dict.auth.email}
          placeholder="you@example.com"
        />
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          label={dict.auth.password}
        />
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <Button type="submit" loading={pending}>
          {pending ? dict.auth.loggingIn : dict.auth.loginButton}
        </Button>
      </form>

      <div className="mt-6 flex items-center justify-between text-sm">
        <Link
          href={`/${locale}/reset-password`}
          className="text-emerald-700 hover:underline dark:text-emerald-400"
        >
          {dict.auth.forgotPassword}
        </Link>
        <p className="text-neutral-500">
          {dict.auth.noAccount}{" "}
          <Link
            href={`/${locale}/signup`}
            className="text-emerald-700 hover:underline dark:text-emerald-400"
          >
            {dict.auth.signupButton}
          </Link>
        </p>
      </div>
    </div>
  );
}
