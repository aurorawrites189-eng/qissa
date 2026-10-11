"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { SITE, type Locale } from "@/lib/site-config";
import type { Dictionary } from "@/lib/i18n/types";
import { LanguageSelector } from "./LanguageSelector";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationBell } from "./NotificationBell";
import { Button } from "./ui/Button";

export function Header({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setUsername(null);
      return;
    }
    createClient()
      .from("public_profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setUsername(data?.username ?? null));
  }, [user]);

  const signOut = () => {
    // GET signs out server-side (clearing cookies) and redirects home.
    window.location.assign(`/${locale}/auth/signout`);
    router.refresh();
  };

  return (
    <header className="border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
      <nav className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href={`/${locale}`} className="flex items-baseline gap-2 font-bold">
          <span className="text-xl text-emerald-800 dark:text-emerald-400">{SITE.name}</span>
          <span className="text-lg text-neutral-500">{SITE.nameUrdu}</span>
        </Link>

        <div className="flex items-center gap-1 text-sm">
          <Link
            href={`/${locale}`}
            className="rounded-lg px-3 py-2 text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            {dict.nav.home}
          </Link>
          <Link
            href={`/${locale}/kids`}
            className="rounded-lg px-3 py-2 text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            {dict.nav.kids}
          </Link>
          <Link
            href={`/${locale}/series`}
            className="rounded-lg px-3 py-2 text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            {dict.nav.series}
          </Link>
        </div>

        <div className="ms-auto flex items-center gap-2">
          <LanguageSelector />
          <ThemeToggle />
          {user ? (
            <>
              {/* Phase 3: notification bell (additive — no existing markup touched). */}
              <NotificationBell lang={locale} dict={dict} />
              <span className="hidden text-sm text-neutral-600 sm:inline dark:text-neutral-300">
                {username ?? user.email}
              </span>
              <Button variant="ghost" onClick={signOut}>
                {dict.nav.signout}
              </Button>
            </>
          ) : (
            <>
              <Link
                href={`/${locale}/login`}
                className="rounded-lg px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                {dict.nav.login}
              </Link>
              <Link href={`/${locale}/signup`}>
                <Button>{dict.nav.signup}</Button>
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
