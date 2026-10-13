import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { signupSchema, ageClassFromBirthYear } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isLocale } from "@/lib/i18n/config";
import { SITE, type Locale } from "@/lib/site-config";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "edge";

/** Sign up via JSON POST (Route Handler). See login route for why. */
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
  const rl = checkRateLimit(`signup:${ip}`, 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: dict.validation.tooManyAttempts }, { status: 429 });
  }

  const birthYearRaw = body.birth_year;
  const preferredLanguageRaw = body.preferred_language;
  const parsed = signupSchema.safeParse({
    email: body.email,
    password: body.password,
    username: body.username,
    birth_year:
      typeof birthYearRaw === "string" && birthYearRaw !== "" ? Number(birthYearRaw) : birthYearRaw,
    preferred_language:
      typeof preferredLanguageRaw === "string" && preferredLanguageRaw !== ""
        ? preferredLanguageRaw
        : lang,
  });
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: dict.validation.genericError,
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }
  const { email, password, username, birth_year, preferred_language } = parsed.data;

  const cookiesToSet: { name: string; value: string; options: CookieOptions }[] = [];
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
          cookiesToSet.push(...list);
        },
      },
    }
  );

  const { data: existing } = await supabase
    .from("public_profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: dict.validation.usernameTaken }, { status: 400 });
  }

  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, preferred_language },
      ...(base ? { emailRedirectTo: `${base}/${lang}/auth/callback` } : {}),
    },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const user = data.user;
  if (!user) {
    return NextResponse.json({ error: dict.validation.genericError }, { status: 500 });
  }

  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { error: profileError } = await admin.from("profiles").insert({
    id: user.id,
    username,
    display_name: username,
    preferred_language,
    birth_year,
    age_class: ageClassFromBirthYear(birth_year),
  });
  if (profileError) {
    if (profileError.code === "23505") {
      return NextResponse.json({ error: dict.validation.usernameTaken }, { status: 400 });
    }
    return NextResponse.json({ error: dict.validation.genericError }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true, dest: `/${lang}/auth/verify` });
  cookiesToSet.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options)
  );
  return response;
}
