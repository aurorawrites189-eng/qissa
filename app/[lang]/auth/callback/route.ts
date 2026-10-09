import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { SITE } from "@/lib/site-config";

/**
 * Handles Supabase auth redirects (email verification, password recovery):
 * exchanges the `code` for a session, then redirects to `?next=` (relative
 * paths only, to avoid open redirects).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  let next = url.searchParams.get("next") ?? `/${SITE.defaultLocale}`;
  if (!next.startsWith("/")) next = `/${SITE.defaultLocale}`;

  if (code) {
    const response = NextResponse.redirect(new URL(next, url.origin));
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return response;
  }

  return NextResponse.redirect(new URL(`/${SITE.defaultLocale}/auth/login`, url.origin));
}
