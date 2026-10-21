import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale: Locale = isLocale(lang) ? lang : "en";
  const base = SITE.url.replace(/\/$/, "");
  // Self-referencing canonical: middleware rewrites clean URLs to the
  // internal /{lang}/... routes and passes the original clean pathname in
  // the "x-nazmhub-path" request header. Fall back to the homepage.
  const hdrs = await headers();
  const cleanPath = hdrs.get("x-nazmhub-path") || "/";
  const pageUrl = cleanPath === "/" ? base : `${base}${cleanPath}`;
  const title = `${SITE.name} — ${SITE.tagline}`;
  const description =
    locale === "ur"
      ? `${SITE.nameUrdu} — ${SITE.taglineUrdu} اردو اور انگریزی میں لکھنے اور پڑھنے کی کمیونٹی۔`
      : `${SITE.name} — ${SITE.tagline} A multilingual (Urdu + English) community for writers and readers.`;
  return {
    metadataBase: new URL(base),
    title: {
      default: title,
      template: `%s · ${SITE.name}`,
    },
    description,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      type: "website",
      siteName: SITE.name,
      title,
      description,
      url: pageUrl,
      locale: locale === "ur" ? "ur_PK" : "en_US",
      alternateLocale: locale === "ur" ? ["en_US"] : ["ur_PK"],
      images: [
        {
          url: `${base}/og-image.png`,
          width: 1200,
          height: 630,
          alt: `${SITE.name} — ${SITE.tagline}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${base}/og-image.png`],
    },
    robots: {
      index: true,
      follow: true,
    },
    icons: {
      icon: "/favicon.png",
      apple: "/favicon.png",
    },
    // Google Search Console ownership verification (meta tag supplied by the site owner).
    verification: {
      google: "I23x8fplXm806WEm2SNhslb2aQBzlJLF4F-FcHSbbQQ",
    },
  };
}

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
