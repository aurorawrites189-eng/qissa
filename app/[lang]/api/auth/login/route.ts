import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { loginSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isLocale } from "@/lib/i18n/config";
import { SITE, type Locale } from "@/lib/site-config";

export const runtime = "edge";

/**
 * Login via JSON POST (Route Handler).
 *
 * Replaces the login Server Action: on this Cloudflare Pages deployment the
 * Server Action transport (Next-Action POST) fails before reaching the
 * action function, while Route Handlers work reliably. Same logic, same
 * validation, same rate limiting — just plain HTTP.
 */
export async function POST(request: NextRequest) {
  let body: { email?: unknown; password?: unknown; lang?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const lang: Locale = isLocale(typeof body.lang === "string" ? body.lang : "")
    ? (body.lang as Locale)
    : SITE.defaultLocale;
  const dict = await getDictionary(lang);

  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : (request.headers.get("x-real-ip") ?? "unknown");
  const rl = checkRateLimit(`login:${ip}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: dict.validation.tooManyAttempts }, { status: 429 });
  }

  const parsed = loginSchema.safeParse({ email: body.email, password: body.password });
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: dict.validation.genericError,
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  // Collect cookies from Supabase, then attach them to the final response.
  let dest = `/${lang}`;
  const cookiesToSet: { name: string; value: string; options: CookieOptions }[] = [];
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          cookiesToSet.push(...list);
        },
      },
    }
  );

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("age_class")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.age_class === "child") dest = `/${lang}/kids`;
  }

  const response = NextResponse.json({ ok: true, dest });
  cookiesToSet.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options)
  );
  return response;
}
