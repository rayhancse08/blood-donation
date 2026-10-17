import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { randomToken, sha256 } from "./crypto";
import { db } from "./db";
import { requestTime } from "./request-time";

export const SESSION_COOKIE = "bd_session";
const SESSION_DAYS = 30;

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}

/** Creates a session row and returns the raw token (only the hash is stored). */
export async function issueSessionToken(userId: string) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({ data: { tokenHash: sha256(token), userId, expiresAt } });
  return { token, expiresAt };
}

export async function createSession(userId: string) {
  const { token, expiresAt } = await issueSessionToken(userId);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  store.delete(SESSION_COOKIE);
}

export const getCurrentUser = cache(async () => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < (await requestTime()) || session.user.isSuspended) return null;
  return session.user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser(options: { allowIncompleteProfile?: boolean } = {}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.profileCompleted && !options.allowIncompleteProfile) redirect("/onboarding");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}

export function isAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}

export async function findOrCreateUser(input: {
  phone?: string;
  email?: string;
  googleId?: string;
  name?: string;
  photoUrl?: string;
}) {
  if (input.googleId) {
    const byGoogle = await db.user.findUnique({ where: { googleId: input.googleId } });
    if (byGoogle) return byGoogle;

    if (input.email) {
      const byEmail = await db.user.findUnique({ where: { email: input.email } });
      if (byEmail) {
        return db.user.update({
          where: { id: byEmail.id },
          data: {
            googleId: input.googleId,
            name: byEmail.name ?? input.name,
            photoUrl: byEmail.photoUrl ?? input.photoUrl,
          },
        });
      }
    }

    return db.user.create({
      data: {
        googleId: input.googleId,
        email: input.email,
        name: input.name,
        photoUrl: input.photoUrl,
        role: isAdminEmail(input.email) ? "ADMIN" : "USER",
      },
    });
  }

  if (input.phone) {
    return db.user.upsert({
      where: { phone: input.phone },
      update: {},
      create: { phone: input.phone, contactPhone: input.phone },
    });
  }

  if (input.email) {
    return db.user.upsert({
      where: { email: input.email },
      update: {},
      create: { email: input.email, role: isAdminEmail(input.email) ? "ADMIN" : "USER" },
    });
  }

  throw new Error("A phone number, email or Google account is required");
}
