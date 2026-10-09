import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { updateSession } from "./lib/supabase/middleware";
import { isLocale } from "./lib/i18n/config";
import { SITE, type Locale } from "./lib/site-config";

/**
 * Age-gated routing.
 *
 * IMPORTANT: this middleware is UX only. The real enforcement lives in the
 * database: RLS policies (see supabase/migrations/0001_schema.sql) make it
 * impossible for a child account to read non-kids-approved posts even if
 * this middleware is bypassed.
 */
export default async function middleware(request: NextRequest) {
  // 1. Refresh the Supabase session cookie on every request.
  const response = await updateSession(request);

  const { pathname } = request.nextUrl;

  // Root redirects to the default locale.
  if (pathname === "/") {
    return NextResponse.redirect(new URL(`/${SITE.defaultLocale}`, request.url));
  }

  const maybeLang = pathname.split("/")[1];
  const lang: Locale = isLocale(maybeLang) ? maybeLang : SITE.defaultLocale;

  // 2. Paths a child account is allowed to visit.
  //
  // API allowlist for children (Phase 4 fix): Phase 1 middleware
  // 307-redirected child sessions away from EVERYTHING under /api/*, which
  // broke legitimate kid actions (reading-history upsert, filing reports,
  // fetching notifications). Children may now call:
  //   - /[lang]/api/kids/*            (any method — e.g. reading history)
  //   - POST /[lang]/api/reports      (filing a report)
  //   - GET  /[lang]/api/notifications (reading own notifications)
  // Everything else under /api/* stays blocked for children (and RLS
  // policies backstop these endpoints regardless of this middleware).
  const apiPrefix = `/${lang}/api/`;
  const childApiAllowed =
    (request.method === "POST" && pathname === `${apiPrefix}reports`) ||
    (request.method === "GET" && pathname === `${apiPrefix}notifications`) ||
    pathname.startsWith(`${apiPrefix}kids/`);

  const childAllowed =
    pathname === `/${lang}` ||
    pathname === `/${lang}/kids` ||
    pathname.startsWith(`/${lang}/kids/`) ||
    pathname.startsWith(`/${lang}/auth/`) ||
    pathname.startsWith("/auth/") ||
    childApiAllowed;

  if (childAllowed) return response;

  // 3. For everything else, look up the viewer's age_class. Anonymous
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
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return response;

  const { data: profile } = await supabase
    .from("profiles")
    .select("age_class")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.age_class === "child") {
    const url = request.nextUrl.clone();
    url.pathname = `/${lang}/kids`;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Skip static assets; run on everything else (incl. /auth/**).
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
