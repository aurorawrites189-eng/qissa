import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { json, clientIp, rateLimitOr429, requireUser } from "@/lib/api/respond";

export const runtime = "edge";

const historySchema = z.object({
  post_id: z.string().uuid("Invalid post id"),
});

/**
 * POST /[lang]/api/kids/history — record that the signed-in user read a
 * story (upsert into reading_history). Children ARE allowed here — RLS
 * permits owner-only inserts/updates and the "continue reading" shelf on the
 * Kids' page is built from this table.
 *
 * NOTE: Phase-1 middleware redirects signed-in child accounts away from
 * /:lang/api/* paths (they only allow /:lang/kids/*). A child's browser
 * fetch therefore follows a redirect to the Kids' page HTML — the client
 * treats non-JSON responses as a silent no-op. History recording is
 * best-effort; nothing else depends on it.
 */
export async function POST(request: Request) {
  const limited = rateLimitOr429(`kids:history:${await clientIp()}`, 60, 60_000);
  if (limited) return limited;

  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const parsed = historySchema.safeParse(body);
  if (!parsed.success) return json({ error: "invalid_post_id" }, 400);

  const supabase = await createClient();
  const { error } = await supabase.from("reading_history").upsert(
    {
      user_id: auth.ctx.user.id,
      post_id: parsed.data.post_id,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "user_id,post_id" }
  );

  if (error) return json({ error: "history_failed" }, 500);
  return json({ ok: true });
}
