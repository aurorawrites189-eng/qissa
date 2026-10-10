/**
 * POST /[lang]/api/posts/[id]/views
 *
 * Increments a story's view_count. Called FIRE-AND-FORGET from the reader
 * page (client-side on mount) so counting never blocks rendering.
 *
 * LIMITATIONS (documented, by design for v1):
 * - No de-duplication: refreshes, bots and crawlers all increment the
 *   counter. Treat view_count as a rough popularity signal, not analytics.
 * - The increment uses the service-role client because view_count is a
 *   guard-trigger protected column that authors must not self-edit.
 * - The post must be visible to the caller first (RLS check), so hidden
 *   stories can't be "viewed" into the trending feed.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getViewer, jsonError, rateLimitWrite } from "@/lib/api-helpers";

export const runtime = "edge";

interface RouteParams {
  params: Promise<{ lang: string; id: string }>;
}

export async function POST(req: NextRequest, { params: _params }: RouteParams) {
  const params = await _params;
  // Anonymous readers count too — rate-limit by IP instead of user.
  const limited = rateLimitWrite(req, `views:${params.id}`, null, 10, 60_000);
  if (limited) return limited;

  const viewer = await getViewer();
  const { data: post } = await viewer.supabase
    .from("posts")
    .select("id, view_count")
    .eq("id", params.id)
    .maybeSingle();
  if (!post) return jsonError("Story not found", 404);

  const admin = createAdminClient();
  const { error } = await admin
    .from("posts")
    .update({ view_count: (post.view_count ?? 0) + 1 })
    .eq("id", post.id);
  if (error) return jsonError("Could not record the view", 500);

  return NextResponse.json({ ok: true });
}
