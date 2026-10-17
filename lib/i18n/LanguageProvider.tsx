"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Dictionary } from "./types";
import type { Locale } from "../site-config";

interface LanguageContextValue {
  locale: Locale;
  dict: Dictionary;
  setLocale: (locale: Locale) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  children: ReactNode;
}) {
  const setLocale = (next: Locale) => {
    if (next === locale) return;
    // Clean-URL strategy (Oct 2026): the language lives in the
    // "nazmhub-lang" cookie (see middleware.ts), not the URL path.
    // Set the cookie and reload; middleware rewrites the current clean
    // URL (e.g. /kids) to /{next}/... on the next request.
    document.cookie = `nazmhub-lang=${next}; path=/; max-age=31536000; SameSite=Lax`;
    window.location.reload();
  };

  return (
    <LanguageContext.Provider value={{ locale, dict, setLocale }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
