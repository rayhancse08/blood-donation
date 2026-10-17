import { NextResponse, type NextRequest } from "next/server";
import { findOrCreateUser, issueSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { safeEqual } from "@/lib/crypto";
import { normalizeEmail, safeNext } from "@/lib/form";
import { appUrl } from "@/lib/url";

const STATE_COOKIE = "g_state";

type GoogleProfile = { sub?: string; email?: string; email_verified?: boolean; name?: string; picture?: string };

function fail(error: string) {
  const response = NextResponse.redirect(appUrl(`/login?error=${error}`));
  response.cookies.delete(STATE_COOKIE);
  return response;
}

function readState(raw: string | undefined): { state: string; next: string | null } | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { state?: unknown; next?: unknown };
    return typeof value.state === "string" ? { state: value.state, next: safeNext(value.next as string | null) } : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const saved = readState(request.cookies.get(STATE_COOKIE)?.value);
  if (!code || !state || !saved || !safeEqual(state, saved.state)) return fail("google_failed");

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        redirect_uri: appUrl("/api/auth/google/callback"),
        grant_type: "authorization_code",
      }),
    });
    const tokens = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenResponse.ok || !tokens.access_token) return fail("google_failed");

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = (await profileResponse.json()) as GoogleProfile;
    if (!profileResponse.ok || !profile.sub) return fail("google_failed");

    const email = profile.email_verified ? normalizeEmail(profile.email) : null;
    const user = await findOrCreateUser({
      googleId: profile.sub,
      email: email ?? undefined,
      name: profile.name,
      photoUrl: profile.picture,
    });
    if (user.isSuspended) return fail("suspended");

    const { token, expiresAt } = await issueSessionToken(user.id);
    const destination = !user.profileCompleted ? "/onboarding" : (saved.next ?? "/dashboard");
    const response = NextResponse.redirect(appUrl(destination));
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
    response.cookies.delete(STATE_COOKIE);
    return response;
  } catch (error) {
    console.error("[google-auth]", error);
    return fail("google_failed");
  }
}
