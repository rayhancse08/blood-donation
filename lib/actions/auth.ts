"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession, findOrCreateUser } from "@/lib/auth";
import { normalizeEmail, normalizePhone, safeNext } from "@/lib/form";
import { issueOtp, OtpError, verifyOtp } from "@/lib/otp";

export type OtpState = {
  step: "request" | "verify";
  channel: "PHONE" | "EMAIL";
  target?: string;
  error?: string;
  message?: string;
  devCode?: string;
};

export async function requestOtpAction(_prev: OtpState, formData: FormData): Promise<OtpState> {
  const channel = formData.get("channel") === "EMAIL" ? "EMAIL" : "PHONE";
  const raw = String(formData.get("target") ?? "");
  const target = channel === "PHONE" ? normalizePhone(raw) : normalizeEmail(raw);
  if (!target) {
    return {
      step: "request",
      channel,
      error: channel === "PHONE" ? "Enter a valid Bangladeshi mobile number (e.g. 01712345678)." : "Enter a valid email address.",
    };
  }

  try {
    const { devCode } = await issueOtp(channel, target, safeNext(formData.get("next")));
    return {
      step: "verify",
      channel,
      target,
      devCode,
      message:
        channel === "PHONE"
          ? `We sent a 6-digit code by SMS to ${target}.`
          : `We sent a 6-digit code and a sign-in link to ${target}.`,
    };
  } catch (error) {
    return {
      step: "request",
      channel,
      error: error instanceof OtpError ? error.message : "Could not send the code. Please try again.",
    };
  }
}

export async function verifyOtpAction(prev: OtpState, formData: FormData): Promise<OtpState> {
  const target = String(formData.get("target") ?? "");
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  const channel = formData.get("channel") === "EMAIL" ? "EMAIL" : "PHONE";

  if (code.length !== 6) return { ...prev, step: "verify", error: "Enter the 6-digit code." };
  if (!(await verifyOtp(target, code))) return { ...prev, step: "verify", error: "That code is invalid or has expired." };

  const user = await findOrCreateUser(channel === "PHONE" ? { phone: target } : { email: target });
  if (user.isSuspended) return { ...prev, step: "verify", error: "This account has been suspended. Please contact support." };

  await createSession(user.id);
  const next = safeNext(formData.get("next"));
  redirect(!user.profileCompleted ? "/onboarding" : (next ?? "/dashboard"));
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}
