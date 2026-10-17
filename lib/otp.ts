import { generateOtp, hmac, randomToken, safeEqual, sha256 } from "./crypto";
import { db } from "./db";
import { sendEmail } from "./email";
import { sendSms } from "./sms";
import { appUrl } from "./url";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_CODES_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

export class OtpError extends Error {}

export async function issueOtp(channel: "PHONE" | "EMAIL", target: string, next?: string | null) {
  const recent = await db.otpCode.count({
    where: { target, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent >= MAX_CODES_PER_HOUR) throw new OtpError("Too many codes requested. Please try again in an hour.");

  const code = generateOtp();
  const linkToken = channel === "EMAIL" ? randomToken() : null;

  await db.otpCode.create({
    data: {
      channel,
      target,
      codeHash: hmac(`${target}:${code}`),
      linkTokenHash: linkToken ? sha256(linkToken) : null,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  if (channel === "PHONE") {
    await sendSms(target, `Your Blood App verification code is ${code}. It expires in 10 minutes. Do not share it.`);
  } else {
    const params = new URLSearchParams({ token: linkToken! });
    if (next) params.set("next", next);
    const link = appUrl(`/api/auth/verify-link?${params}`);
    await sendEmail(
      target,
      "Your Blood App sign-in code",
      `<p>Your verification code is <strong style="font-size:20px">${code}</strong>.</p>
       <p>Or sign in directly with this link: <a href="${link}">${link}</a></p>
       <p>The code and link expire in 10 minutes. If you did not request this, you can ignore this email.</p>`,
    );
  }

  return { devCode: process.env.NODE_ENV !== "production" ? code : undefined };
}

export async function verifyOtp(target: string, code: string) {
  const otp = await db.otpCode.findFirst({
    where: { target, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp || otp.attempts >= MAX_ATTEMPTS) return false;

  if (!safeEqual(otp.codeHash, hmac(`${target}:${code}`))) {
    await db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return false;
  }

  await db.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
  return true;
}

/** Consumes an email magic-link token and returns the email it was issued for. */
export async function consumeLinkToken(token: string) {
  const otp = await db.otpCode.findUnique({ where: { linkTokenHash: sha256(token) } });
  if (!otp || otp.consumedAt || otp.expiresAt < new Date()) return null;
  await db.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
  return otp.target;
}
