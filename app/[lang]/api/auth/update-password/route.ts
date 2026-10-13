import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isLocale } from "@/lib/i18n/config";
import { SITE, type Locale } from "@/lib/site-config";

export const runtime = "edge";

/** Set a new password in an active recovery session, via JSON POST. */
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
  const rl = checkRateLimit(`updatepw:${ip}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: dict.validation.tooManyAttempts }, { status: 429 });
  }

  const parsed = z
    .object({ password: z.string().min(8).max(128) })
    .safeParse({ password: body.password });
  if (!parsed.success) {
    return NextResponse.json({ error: dict.validation.passwordShort }, { status: 400 });
  }
  if (body.confirm !== parsed.data.password) {
    return NextResponse.json({ error: dict.validation.passwordMismatch }, { status: 400 });
  }

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

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
