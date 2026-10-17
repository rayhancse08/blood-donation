import { NextResponse, type NextRequest } from "next/server";
import { randomToken } from "@/lib/crypto";
import { safeNext } from "@/lib/form";
import { appUrl } from "@/lib/url";

const STATE_COOKIE = "g_state";

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(appUrl("/login?error=google_not_configured"));
  }

  const state = randomToken(16);
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: appUrl("/api/auth/google/callback"),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });

  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  response.cookies.set(STATE_COOKIE, JSON.stringify({ state, next }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}
