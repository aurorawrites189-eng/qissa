import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { checkRateLimit } from "@/lib/rate-limit";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isLocale } from "@/lib/i18n/config";
import { SITE, type Locale } from "@/lib/site-config";

export const runtime = "edge";

/** Re-send the signup verification email via JSON POST. Never reveals if the email exists. */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
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
  const rl = checkRateLimit(`resend:${ip}`, 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: dict.validation.tooManyAttempts }, { status: 429 });
  }

  const email = body.email;
  if (typeof email !== "string" || email.trim() === "") {
    return NextResponse.json({ error: dict.validation.invalidEmail }, { status: 400 });
  }

  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (_list: { name: string; value: string; options: CookieOptions }[]) => {},
      },
    }
  );

  await supabase.auth.resend({
    type: "signup",
    email: email.trim(),
    options: base ? { emailRedirectTo: `${base}/${lang}/auth/callback` } : undefined,
  });
  return NextResponse.json({ ok: true });
}
