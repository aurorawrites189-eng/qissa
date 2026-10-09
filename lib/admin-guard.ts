/**
 * Server-component guard for /admin pages: signed-in admin or redirect.
 * (API routes use requireAdmin() from lib/api-helpers instead, which
 * returns a 403 JSON response rather than redirecting.)
 */
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Locale } from "./site-config";

export async function requireAdminPage(lang: Locale) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/auth/login`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) redirect(`/${lang}`);

  return { supabase, user, profile };
}
