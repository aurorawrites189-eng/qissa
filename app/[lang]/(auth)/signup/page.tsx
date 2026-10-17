"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function SignupPage() {
  const { locale, dict } = useLanguage();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setPending(true);
    try {
      const formData = new FormData(e.currentTarget);
      // Sign up via Route Handler (JSON) — see login page for why.
      const res = await fetch(`/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password"),
          username: formData.get("username"),
          birth_year: formData.get("birth_year"),
          preferred_language: formData.get("preferred_language"),
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
        if (data.fieldErrors) setFieldErrors(data.fieldErrors);
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

  const first = (name: string) => fieldErrors[name]?.[0];

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-bold">{dict.auth.signupTitle}</h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        {dict.auth.signupSubtitle}
      </p>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        <Input
          name="email"
          type="email"
          autoComplete="email"
          required
          label={dict.auth.email}
          placeholder="you@example.com"
          error={first("email")}
        />
        <Input
          name="username"
          autoComplete="username"
          required
          minLength={3}
          maxLength={30}
          label={dict.auth.username}
          placeholder="aabid_writes"
          error={first("username")}
        />
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          label={dict.auth.password}
          error={first("password")}
        />
        <Input
          name="birth_year"
          type="number"
          required
          min={1900}
          max={new Date().getFullYear()}
          label={dict.auth.birthYear}
          placeholder="2005"
          error={first("birth_year")}
        />
        <div className="w-full">
          <label htmlFor="preferred_language" className="mb-1 block text-sm font-medium">
            {dict.auth.preferredLanguage}
          </label>
          <select
            id="preferred_language"
            name="preferred_language"
            defaultValue={locale}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option value="en">English</option>
            <option value="ur">اردو</option>
          </select>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <Button type="submit" loading={pending}>
          {pending ? dict.auth.creatingAccount : dict.auth.signupButton}
        </Button>
      </form>

      <p className="mt-6 text-sm text-neutral-500">
        {dict.auth.haveAccount}{" "}
        <Link
          href={`/login`}
          className="text-emerald-700 hover:underline dark:text-emerald-400"
        >
          {dict.auth.loginButton}
        </Link>
      </p>
    </div>
  );
}
