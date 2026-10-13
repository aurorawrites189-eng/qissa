import { NextResponse } from "next/server";

export const runtime = "edge";

/**
 * TEMPORARY diagnostic route (delete after debugging).
 * Reproduces the login/reset server-action setup step-by-step on the edge
 * worker and returns the exact throw site + message as JSON.
 * Returns no secrets — only status strings and public error messages.
 */
function msg(e: unknown): string {
  return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}

export async function GET(request: Request) {
  const out: Record<string, string> = {};

  // 1. Import every module in the actions.ts import graph, one by one.
  const modules = [
    "@/lib/supabase/server",
    "@/lib/validation",
    "@/lib/rate-limit",
    "@/lib/i18n/get-dictionary",
    "@/lib/i18n/config",
    "@/lib/site-config",
  ];
  for (const m of modules) {
    try {
      await import(m);
      out["import " + m] = "ok";
    } catch (e) {
      out["import " + m] = "THROW: " + msg(e);
    }
  }

  // 2. Import the "use server" actions module itself.
  let actions: Record<string, Function> | null = null;
  try {
    actions = (await import("@/app/[lang]/(auth)/actions")) as Record<string, Function>;
    out["import actions"] = "ok [" + Object.keys(actions).join(",") + "]";
  } catch (e) {
    out["import actions"] = "THROW: " + msg(e);
    return NextResponse.json(out);
  }

  // 3. Run getDictionary like the actions do.
  try {
    const { getDictionary } = (await import("@/lib/i18n/get-dictionary")) as {
      getDictionary: (l: string) => Promise<{ validation: { genericError: string } }>;
    };
    const d = await getDictionary("en");
    out.getDictionary = "ok genericError=" + JSON.stringify(d.validation.genericError);
  } catch (e) {
    out.getDictionary = "THROW: " + msg(e);
  }

  // 4. Create the server Supabase client.
  let supabase: {
    auth: { signInWithPassword: (c: { email: string; password: string }) => Promise<{ error: { message: string } | null }> };
  } | null = null;
  try {
    const { createClient } = (await import("@/lib/supabase/server")) as {
      createClient: () => Promise<{
        auth: { signInWithPassword: (c: { email: string; password: string }) => Promise<{ error: { message: string } | null }> };
      }>;
    };
    supabase = await createClient();
    out.createClient = "ok";
  } catch (e) {
    out.createClient = "THROW: " + msg(e);
  }

  // 5. Direct auth call with a bad password (expect "Invalid login credentials").
  if (supabase) {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: "test@example.com",
        password: "wrong-password-123",
      });
      out.signInWithPassword = error ? "returned error (expected): " + error.message : "UNEXPECTED SUCCESS";
    } catch (e) {
      out.signInWithPassword = "THROW: " + msg(e);
    }
  }

  // 6. Call the real reset action with synthetic FormData (same as the page does).
  try {
    const fd = new FormData();
    fd.set("email", "test@example.com");
    fd.set("lang", "en");
    const result = await (
      actions as unknown as {
        requestPasswordResetAction: (fd: FormData) => Promise<{ error?: string }>;
      }
    ).requestPasswordResetAction(fd);
    out.resetAction = "returned: " + JSON.stringify(result);
  } catch (e) {
    out.resetAction = "THROW: " + msg(e);
  }

  // 7. Self-fetch: perform a REAL Server Action POST (Next-Action transport)
  // against this same worker, exactly like the browser does.
  try {
    const selfUrl = new URL("/en/reset-password", request.url);
    const boundary = "----debugboundary123";
    const body =
      `--${boundary}\r\nContent-Disposition: form-data; name="email"\r\n\r\ntest@example.com\r\n` +
      `--${boundary}\r\nContent-Disposition: form-data; name="lang"\r\n\r\nen\r\n` +
      `--${boundary}--\r\n`;
    const tree = encodeURIComponent('["",{},null,null,true]');
    const res = await fetch(selfUrl, {
      method: "POST",
      headers: {
        "Next-Action": "696048f016bdef2885eca80978761ca1386e90",
        "Next-Router-State-Tree": tree,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body,
      signal: AbortSignal.timeout(20000),
    });
    const text = await res.text();
    out.selfActionPost = `HTTP ${res.status} body[0:400]=` + text.slice(0, 400);
  } catch (e) {
    out.selfActionPost = "THROW/HANG: " + msg(e);
  }

  return NextResponse.json(out);
}
