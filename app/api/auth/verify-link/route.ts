import { NextResponse, type NextRequest } from "next/server";
import { findOrCreateUser, issueSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { safeNext } from "@/lib/form";
import { consumeLinkToken } from "@/lib/otp";
import { appUrl } from "@/lib/url";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const email = token ? await consumeLinkToken(token) : null;
  if (!email) return NextResponse.redirect(appUrl("/login?error=link_invalid"));

  const user = await findOrCreateUser({ email });
  if (user.isSuspended) return NextResponse.redirect(appUrl("/login?error=suspended"));

  const { token: sessionToken, expiresAt } = await issueSessionToken(user.id);
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const response = NextResponse.redirect(appUrl(!user.profileCompleted ? "/onboarding" : (next ?? "/dashboard")));
  response.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions(expiresAt));
  return response;
}
