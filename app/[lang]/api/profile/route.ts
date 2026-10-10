import { createClient } from "@/lib/supabase/server";
import { profileUpdateSchema } from "@/lib/validation";
import { json, clientIp, rateLimitOr429, requireUser } from "@/lib/api/respond";

export const runtime = "edge";

/**
 * PATCH /[lang]/api/profile — update your own display name, bio and
 * preferred language. Any signed-in user (children included — profile
 * editing is not in the Phase-1 child-write denylist).
 *
 * RLS `profiles_update_own` scopes the row; the `protect_profile_fields`
 * trigger additionally rejects changes to privileged / moderation columns
 * (username, age_class, strikes, suspension, is_admin, …).
 */
export async function PATCH(request: Request) {
  const limited = rateLimitOr429(`profile:update:${await clientIp()}`, 20, 60_000);
  if (limited) return limited;

  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const parsed = profileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "invalid_profile", details: parsed.error.flatten().fieldErrors }, 400);
  }
  if (Object.keys(parsed.data).length === 0) {
    return json({ error: "nothing_to_update" }, 400);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update(parsed.data)
    .eq("id", auth.ctx.user.id)
    .select("id, username, display_name, avatar_url, bio, preferred_language")
    .single();

  if (error) return json({ error: "update_failed" }, 500);
  return json({ profile: data });
}
