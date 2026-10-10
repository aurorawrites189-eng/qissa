/**
 * Shared helpers for API route handlers: JSON responses, viewer context
 * (session + profile), client IP extraction, and write rate-limiting.
 *
 * Every route does its own explicit age/admin checks IN ADDITION to RLS —
 * RLS is the last line of defense, not the error message the user sees.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "./supabase/server";
import { checkRateLimit } from "./rate-limit";

export interface ViewerProfile {
  id: string;
  username: string;
  age_class: "child" | "adult" | null;
  is_admin: boolean;
  is_suspended: boolean;
}

export interface ViewerContext {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string | null;
  profile: ViewerProfile | null;
}

/** Session + own profile (RLS-safe: users can always read their own row). */
export async function getViewer(): Promise<ViewerContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, userId: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, age_class, is_admin, is_suspended")
    .eq("id", user.id)
    .maybeSingle();
  return { supabase, userId: user.id, profile: (profile as ViewerProfile | null) ?? null };
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function unauthorized(message = "Sign in required") {
  return jsonError(message, 401);
}

export function forbidden(message = "Not allowed") {
  return jsonError(message, 403);
}

export function notFound(message = "Not found") {
  return jsonError(message, 404);
}

/** Require a signed-in, non-suspended user. Returns the context or a response. */
export function requireUser(ctx: ViewerContext): ViewerContext | NextResponse {
  if (!ctx.userId || !ctx.profile) return unauthorized();
  if (ctx.profile.is_suspended) {
    return jsonError("Your account is suspended", 403);
  }
  return ctx;
}

/** Require an adult (non-child) user. Children get an explicit 403. */
export function requireAdult(ctx: ViewerContext): ViewerContext | NextResponse {
  const ok = requireUser(ctx);
  if (ok instanceof NextResponse) return ok;
  if (ok.profile?.age_class === "child") {
    return forbidden("This action is not available for kids accounts");
  }
  return ok;
}

/** Require an admin user. */
export function requireAdmin(ctx: ViewerContext): ViewerContext | NextResponse {
  const ok = requireUser(ctx);
  if (ok instanceof NextResponse) return ok;
  if (!ok.profile?.is_admin) return forbidden("Admin only");
  return ok;
}

function isResponse(v: ViewerContext | NextResponse): v is NextResponse {
  return v instanceof NextResponse;
}

export { isResponse as isErrorResponse };

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Rate-limit a write. Returns null when allowed, or a 429 JSON response.
 * Key on user id when signed in, else IP.
 */
export function rateLimitWrite(
  req: NextRequest,
  scope: string,
  userId: string | null,
  maxRequests = 20,
  windowMs = 60_000
): NextResponse | null {
  const key = `${scope}:${userId ?? getClientIp(req)}`;
  const result = checkRateLimit(key, maxRequests, windowMs);
  if (!result.allowed) {
    return NextResponse.json(
      { error: "Too many requests — please slow down" },
      { status: 429, headers: { "Retry-After": String(result.retryAfterSec) } }
    );
  }
  return null;
}

/** Parse a positive-int query param with bounds. */
export function parsePageParam(value: string | null, def: number, max: number): number {
  const n = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(n) || n < 1) return def;
  return Math.min(n, max);
}
