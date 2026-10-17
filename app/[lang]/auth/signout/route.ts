import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { isLocale } from "@/lib/i18n/config";
import { SITE } from "@/lib/site-config";

export const runtime = "edge";

function homeUrl(request: NextRequest): URL {
  const seg = new URL(request.url).pathname.split("/")[1];
  const lang = isLocale(seg) ? seg : SITE.defaultLocale;
  return new URL(`/`, request.url);
}

async function signOut(request: NextRequest) {
  const response = NextResponse.redirect(homeUrl(request));
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );
  await supabase.auth.signOut();
  return response;
}

export async function GET(request: NextRequest) {
  return signOut(request);
}

export async function POST(request: NextRequest) {
  return signOut(request);
}
