import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { SITE, type Locale } from "@/lib/site-config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isLocale, localeDirections } from "@/lib/i18n/config";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import "../globals.css";

// Cloudflare Pages/Workers only run the Edge Runtime — this makes every
// page under [lang] edge-compatible (required by @cloudflare/next-on-pages).
export const runtime = "edge";

export const metadata: Metadata = {
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.tagline,
};

// Applies the saved (or system-preferred) theme before first paint so the
// page doesn't flash the wrong color scheme.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('qissa-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`;

// NOTE: there is intentionally no app/layout.tsx. Following the documented
// Next.js i18n-routing pattern, app/[lang]/layout.tsx is the topmost layout
// for every route, so it renders <html>/<body> with the per-locale lang/dir.
export default async function LangLayout({
  children,
  params: _params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const params = await _params;
  if (!isLocale(params.lang)) notFound();
  const lang: Locale = params.lang;
  const dict = await getDictionary(lang);

  return (
    <html lang={lang} dir={localeDirections[lang]} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <LanguageProvider locale={lang} dict={dict}>
          <Header locale={lang} dict={dict} />
          <main className="flex-1">{children}</main>
          <Footer dict={dict} locale={lang} />
        </LanguageProvider>
      </body>
    </html>
  );
}
