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
  // Unique title + description per page. Every page used to share the same
  // title ("NazmHub — Write. Read. Belong."), so Google showed the same
  // snippet for all of them. The clean path comes from the
  // "x-nazmhub-path" header (see canonical comment above).
  const pageMeta: Record<string, { title: string; description: string }> = {
    "/series": {
      title: "Cliffhangers — Serial Stories in Urdu & English",
      description:
        "Read serial episode novels (Cliffhangers) in Urdu and English on NazmHub — one episode at a time, free to read.",
    },
    "/kids": {
      title: "Kids Stories in Urdu & English",
      description:
        "Original kids' stories in Urdu and English on NazmHub — safe, reviewed stories for young readers.",
    },
    "/write": {
      title: "Write a Story",
      description:
        "Write and publish your own stories in Urdu or English on NazmHub.",
    },
    "/download": {
      title: "Free Story Books — Download",
      description:
        "Download free completed serial story books as PDFs from NazmHub.",
    },
    "/login": {
      title: "Log In",
      description: "Log in to your NazmHub account to write, read and save stories.",
    },
    "/signup": {
      title: "Sign Up",
      description:
        "Create your free NazmHub account and start writing and reading stories in Urdu and English.",
    },
    "/feed": {
      title: "Feed — Latest Stories",
      description: "The latest stories and serial episodes published on NazmHub.",
    },
  };
  // Dynamic pages (/series/<id>, /kids/story/<id>, /posts/<id>) get a
  // section-level title instead of the homepage title.
  const section = cleanPath.split("/").filter(Boolean)[0];
  const sectionMeta: Record<string, { title: string; description: string }> = {
    series: {
      title: "Cliffhangers — Serial Story",
      description: "Read this serial episode novel in Urdu or English on NazmHub.",
    },
    kids: {
      title: "Kids Story",
      description: "Read this original kids' story in Urdu or English on NazmHub.",
    },
    posts: {
      title: "Story",
      description: "Read this story on NazmHub.",
    },
  };
  const meta = pageMeta[cleanPath] ?? (section ? sectionMeta[section] : undefined);
  const title = meta
    ? `${meta.title} · ${SITE.name}`
    : `${SITE.name} — ${SITE.tagline}`;
  const description =
    meta?.description ??
    (locale === "ur"
      ? `${SITE.nameUrdu} — ${SITE.taglineUrdu} اردو اور انگریزی میں لکھنے اور پڑھنے کی کمیونٹی۔`
      : `${SITE.name} — ${SITE.tagline} A multilingual (Urdu + English) community for writers and readers.`);
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
