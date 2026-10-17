import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "bd_session";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/profile",
  "/onboarding",
  "/requests/new",
  "/messages",
  "/notifications",
  "/donations",
  "/orders",
  "/payments",
  "/pay",
  "/partner",
  "/assistant",
  "/admin",
  "/pharmacy/checkout",
];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const needsAuth = PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (needsAuth && !request.cookies.has(SESSION_COOKIE)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
