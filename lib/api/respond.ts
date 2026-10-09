import { headers } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export function clientIp(): string {
  const h = headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

/**
 * Apply the in-memory token-bucket limiter. Returns a 429 Response when the
 * caller is over budget, otherwise null.
 */
export function rateLimitOr429(key: string, maxRequests = 20, windowMs = 60_000): Response | null {
  const rl = checkRateLimit(key, maxRequests, windowMs);
  if (!rl.allowed) {
    return Response.json(
      { error: "too_many_requests", retry_after_sec: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }
  return null;
}

export interface AuthedContext {
  user: User;
  /** 'child' | 'adult' | null (null = profile row missing; treat as adult). */
  ageClass: "child" | "adult" | null;
}

/**
 * Require a signed-in user. Returns { ctx } on success or { response } with
 * a 401 to return directly from the route handler.
 */
export async function requireUser(): Promise<{ ctx: AuthedContext } | { response: Response }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { response: json({ error: "unauthorized" }, 401) };

  const { data: profile } = await supabase
    .from("profiles")
    .select("age_class")
    .eq("id", user.id)
    .maybeSingle();

  const ageClass = (profile?.age_class as "child" | "adult" | null) ?? null;
  return { ctx: { user, ageClass } };
}

/**
 * Require a signed-in ADULT user (children are read-only on writes).
 * Returns { ctx } on success or { response } with 401/403 to return directly.
 *
 * NOTE: this is defense-in-depth — the middleware already redirects child
 * accounts away from write routes/pages, and RLS denies child writes at the
 * database level. The explicit 403 here makes the API contract obvious and
 * keeps the check testable without a browser round-trip.
 */
export async function requireAdult(): Promise<{ ctx: AuthedContext } | { response: Response }> {
  const result = await requireUser();
  if ("response" in result) return result;
  if (result.ctx.ageClass === "child") {
    return { response: json({ error: "forbidden_child_account" }, 403) };
  }
  return result;
}
