import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { updateSession } from "./lib/supabase/middleware";
import { isLocale } from "./lib/i18n/config";
import { SITE, type Locale } from "./lib/site-config";

/**
 * Language cookie name. The user's language preference is stored here;
 * middleware reads it to rewrite clean URLs (e.g. /kids) to the internal
 * /{lang}/... routes. Defaults to SITE.defaultLocale when absent.
 */
export const LANG_COOKIE = "nazmhub-lang";

function getLangFromCookie(request: NextRequest): Locale {
  const v = request.cookies.get(LANG_COOKIE)?.value;
  return v && isLocale(v) ? v : SITE.defaultLocale;
}

/**
 * Age-gated routing + clean-URL language rewrites.
 *
 * URL strategy (Oct 2026): public URLs carry NO language prefix.
 *   /kids            -> rewritten internally to /{lang}/kids
 *   /                -> rewritten internally to /{lang}
 *   /en/kids (old)   -> 301 redirect to /kids (+ sets nazmhub-lang=en)
 *   /ur/kids (old)   -> 301 redirect to /kids (+ sets nazmhub-lang=ur)
 *
 * The [lang] app directory is kept as-is; the rewrite makes params.lang
 * resolve from the cookie. All internal link generation must use clean
 * URLs (no /{lang} prefix).
 *
 * Age-gating note: the checks below run against the EFFECTIVE
 * lang-prefixed path (what the rewrite target would be), so the child
 * restrictions keep working on clean URLs.
 *
 * IMPORTANT: the RLS policies are the real enforcement; this middleware
 * is UX only (see supabase/migrations/0001_schema.sql).
 */
export default async function middleware(request: NextRequest) {
  // 1. Refresh the Supabase session cookie on every request.
  const sessionResponse = await updateSession(request);

  const { pathname } = request.nextUrl;

  // 2. Old-style /en/* and /ur/* URLs: 301 redirect to the clean URL and
  //    remember the explicit language choice in the cookie.
  const firstSeg = pathname.split("/")[1];
  if (isLocale(firstSeg)) {
    const rest = pathname.slice(firstSeg.length + 1); // "" or "/kids" etc.
    const cleanPath = rest || "/";
    const url = request.nextUrl.clone();
    url.pathname = cleanPath;
    // Preserve query string on redirect.
    const redirectRes = NextResponse.redirect(url, 301);
    redirectRes.cookies.set(LANG_COOKIE, firstSeg, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    // Carry over any Supabase session cookies set by updateSession.
    for (const c of sessionResponse.cookies.getAll()) {
      redirectRes.cookies.set(c.name, c.value);
    }
    return redirectRes;
  }

  const lang: Locale = getLangFromCookie(request);

  // Paths that are NOT part of the localized [lang] tree and must pass
  // through untouched (no rewrite): the sitemap, robots.txt, and the
  // temporary diagnostic route at app/api/debug-auth.
  const passthroughPaths = ["/sitemap.xml", "/robots.txt", "/api/debug-auth"];
  if (passthroughPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return sessionResponse;
  }

  // Effective internal path (what the [lang] router will see).
  const effectivePath = pathname === "/" ? `/${lang}` : `/${lang}${pathname}`;

  // Helper: build a rewrite response to the effective path while keeping
  // the Supabase session cookies from updateSession().
  const rewriteWithSession = () => {
    const url = request.nextUrl.clone();
    url.pathname = effectivePath;
    // Carry the ORIGINAL clean pathname into the rewritten request so the
    // root layout can emit a self-referencing canonical URL for the page
    // (internal /{lang}/... path must never leak into canonical/OG URLs).
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nazmhub-path", pathname);
    const res = NextResponse.rewrite(url, {
      request: { headers: requestHeaders },
    });
    for (const c of sessionResponse.cookies.getAll()) {
      res.cookies.set(c.name, c.value);
    }
    return res;
  };

  // 3. Paths a child account is allowed to visit (checked against the
  //    effective lang-prefixed path).
  //
  // API allowlist for children (Phase 4 fix): children may call
  //   - /[lang]/api/kids/*            (any method — e.g. reading history)
  //   - POST /[lang]/api/reports      (filing a report)
  //   - GET  /[lang]/api/notifications (reading own notifications)
  // Everything else under /api/* stays blocked for children (and RLS
  // policies backstop these endpoints regardless of this middleware).
  //
  // NOTE: clean-URL API calls are /api/*; the effective path is
  // /{lang}/api/* after the rewrite mapping.
  const apiPrefix = `/${lang}/api/`;
  const childApiAllowed =
    (request.method === "POST" && effectivePath === `${apiPrefix}reports`) ||
    (request.method === "GET" && effectivePath === `${apiPrefix}notifications`) ||
    effectivePath.startsWith(`${apiPrefix}kids/`);

  const childAllowed =
    effectivePath === `/${lang}` ||
    effectivePath === `/${lang}/kids` ||
    effectivePath.startsWith(`/${lang}/kids/`) ||
    effectivePath.startsWith(`/${lang}/auth/`) ||
    effectivePath.startsWith("/auth/") ||
    childApiAllowed;

  if (childAllowed) return rewriteWithSession();

  // 4. For everything else, look up the viewer's age_class. Anonymous
  // visitors are treated as adults here (RLS still filters what they see).
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) =>
            sessionResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return rewriteWithSession();

  const { data: profile } = await supabase
    .from("profiles")
    .select("age_class")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.age_class === "child") {
    // Redirect to the clean /kids URL; the rewrite maps it to /{lang}/kids.
    const url = request.nextUrl.clone();
    url.pathname = "/kids";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return rewriteWithSession();
}

export const config = {
  matcher: [
    // Skip static assets; run on everything else (incl. /auth/**).
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
