"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { signupSchema, loginSchema, ageClassFromBirthYear } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isLocale } from "@/lib/i18n/config";
import { SITE, type Locale } from "@/lib/site-config";

export interface ActionResult {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

function getLang(formData: FormData): Locale {
  const raw = formData.get("lang");
  return isLocale(typeof raw === "string" ? raw : "") ? (raw as Locale) : SITE.defaultLocale;
}

async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
}

/** Log in with email + password. Password hashing is handled by Supabase. */
export async function loginAction(formData: FormData): Promise<ActionResult> {
  const lang = getLang(formData);
  const dict = await getDictionary(lang);

  const rl = checkRateLimit(`login:${await clientIp()}`, 10, 60_000);
  if (!rl.allowed) return { error: dict.validation.tooManyAttempts };

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      error: dict.validation.genericError,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: dict.validation.genericError };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let dest = `/${lang}`;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("age_class")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.age_class === "child") dest = `/${lang}/kids`;
  }
  redirect(dest);
}

/**
 * Sign up: creates the auth user via Supabase (which hashes the password —
 * we never handle plaintext ourselves beyond forwarding it to Supabase),
 * then creates the matching profiles row.
 */
export async function signupAction(formData: FormData): Promise<ActionResult> {
  const lang = getLang(formData);
  const dict = await getDictionary(lang);

  const rl = checkRateLimit(`signup:${await clientIp()}`, 5, 60_000);
  if (!rl.allowed) return { error: dict.validation.tooManyAttempts };

  const birthYearRaw = formData.get("birth_year");
  const preferredLanguageRaw = formData.get("preferred_language");
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    username: formData.get("username"),
    birth_year:
      typeof birthYearRaw === "string" && birthYearRaw !== "" ? Number(birthYearRaw) : birthYearRaw,
    preferred_language:
      typeof preferredLanguageRaw === "string" && preferredLanguageRaw !== ""
        ? preferredLanguageRaw
        : lang,
  });
  if (!parsed.success) {
    return {
      error: dict.validation.genericError,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const { email, password, username, birth_year, preferred_language } = parsed.data;

  const supabase = await createClient();

  // Username uniqueness check (schema lowercases; compare case-insensitively).
  const { data: existing } = await supabase
    .from("public_profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (existing) return { error: dict.validation.usernameTaken };

  const base = siteUrl();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, preferred_language },
      ...(base ? { emailRedirectTo: `${base}/${lang}/auth/callback` } : {}),
    },
  });
  if (error) return { error: error.message };
  const user = data.user;
  if (!user) return { error: dict.validation.genericError };

  // Insert the profile with the service role: the new user may not have a
  // session yet (email confirmation), so RLS would block a regular insert.
  // The UNIQUE constraint on profiles.username is the final guard against a
  // race between the check above and this insert.
  const admin = createAdminClient();
  const { error: profileError } = await admin.from("profiles").insert({
    id: user.id,
    username,
    display_name: username,
    preferred_language,
    birth_year,
    age_class: ageClassFromBirthYear(birth_year),
  });
  if (profileError) {
    if (profileError.code === "23505") return { error: dict.validation.usernameTaken };
    return { error: dict.validation.genericError };
  }

  redirect(`/${lang}/auth/verify`);
}

/** Re-send the signup verification email. Never reveals if the email exists. */
export async function resendVerificationAction(formData: FormData): Promise<ActionResult> {
  const lang = getLang(formData);
  const dict = await getDictionary(lang);

  const rl = checkRateLimit(`resend:${await clientIp()}`, 5, 60_000);
  if (!rl.allowed) return { error: dict.validation.tooManyAttempts };

  const email = formData.get("email");
  if (typeof email !== "string" || email.trim() === "") {
    return { error: dict.validation.invalidEmail };
  }

  const base = siteUrl();
  const supabase = await createClient();
  await supabase.auth.resend({
    type: "signup",
    email: email.trim(),
    options: base ? { emailRedirectTo: `${base}/${lang}/auth/callback` } : undefined,
  });
  return {};
}

/** Send a password-reset link. Never reveals if the email exists. */
export async function requestPasswordResetAction(formData: FormData): Promise<ActionResult> {
  // The whole body is wrapped: on Cloudflare's edge worker an exception in
  // ANY setup step used to surface as a generic "Something went wrong".
  // We now always return a readable message instead.
  try {
    return await requestPasswordResetInner(formData);
  } catch (e) {
    return { error: `Reset failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function requestPasswordResetInner(formData: FormData): Promise<ActionResult> {
  const lang = getLang(formData);
  const dict = await getDictionary(lang);

  const rl = checkRateLimit(`reset:${await clientIp()}`, 5, 60_000);
  if (!rl.allowed) return { error: dict.validation.tooManyAttempts };

  const email = formData.get("email");
  if (typeof email !== "string" || email.trim() === "") {
    return { error: dict.validation.invalidEmail };
  }

  const base = siteUrl();
  const supabase = await createClient();
  // NOTE: keep the supabase-js PKCE call (do NOT switch to a raw /recover
  // fetch): only the PKCE flow makes gotrue append ?code= to the email link,
  // which the /auth/callback route needs to establish the recovery session.
  const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    ...(base
      ? {
          redirectTo: `${base}/${lang}/auth/callback?next=/${lang}/reset-password`,
        }
      : {}),
  });
  // Surface real send failures (rate limits, bad redirect) instead of a
  // silent "success". Unknown emails still return no error (no enumeration).
  if (resetError) return { error: resetError.message };
  return {};
}

/** Set a new password (used in an active recovery session). */
export async function updatePasswordAction(formData: FormData): Promise<ActionResult> {
  try {
    return await updatePasswordInner(formData);
  } catch (e) {
    return { error: `Reset failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function updatePasswordInner(formData: FormData): Promise<ActionResult> {
  const lang = getLang(formData);
  const dict = await getDictionary(lang);

  const rl = checkRateLimit(`updatepw:${await clientIp()}`, 10, 60_000);
  if (!rl.allowed) return { error: dict.validation.tooManyAttempts };

  const parsed = z
    .object({ password: z.string().min(8).max(128) })
    .safeParse({ password: formData.get("password") });
  if (!parsed.success) return { error: dict.validation.passwordShort };

  const newPassword = formData.get("confirm");
  if (newPassword !== parsed.data.password) {
    return { error: dict.validation.passwordMismatch };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };
  return {};
}
