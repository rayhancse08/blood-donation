"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ONLINE_PAYMENT_METHOD_VALUES } from "@/lib/constants";
import { generateReference, randomToken } from "@/lib/crypto";
import { db } from "@/lib/db";
import { type ActionState, FormError, optStr, reqEnum, reqNumber, reqStr, toFormErrorState } from "@/lib/form";
import { calculateDiscount, toPoisha } from "@/lib/money";
import { isSandboxEnabled, markPaymentFailed, markPaymentPaid, paymentReturnPath, startCheckout } from "@/lib/payments";

export async function createServicePaymentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  let redirectTo = "";

  try {
    const facilityId = reqStr(formData, "facilityId", "Provider", 50);
    const facility = await db.facility.findFirst({
      where: { id: facilityId, isActive: true, partnerStatus: "APPROVED" },
    });
    if (!facility) throw new FormError("This provider does not accept in-app payments.");

    const amount = toPoisha(reqNumber(formData, "amount", "Amount", 10, 500_000));
    const { discount, total } = calculateDiscount(amount, facility.discountPercent);
    const method = reqEnum(formData, "method", ONLINE_PAYMENT_METHOD_VALUES, "Payment method");

    const payment = await db.payment.create({
      data: {
        receiptNo: generateReference("RCT"),
        userId: user.id,
        facilityId,
        purpose: "SERVICE",
        description: optStr(formData, "description", 200) ?? `Payment to ${facility.name}`,
        amount,
        discount,
        total,
        method,
      },
    });

    try {
      redirectTo = await startCheckout(payment);
    } catch {
      await markPaymentFailed(payment.id, "FAILED");
      throw new FormError("The payment gateway is unavailable right now. Please try another method.");
    }
  } catch (error) {
    return toFormErrorState(error);
  }

  redirect(redirectTo);
}

export async function retryPaymentAction(paymentId: string) {
  const user = await requireUser();
  const payment = await db.payment.findFirst({ where: { id: paymentId, userId: user.id, status: "PENDING" } });
  if (!payment) redirect("/payments");
  const fallback = paymentReturnPath(payment);
  const target = await startCheckout(payment).catch(() => `${fallback}${fallback.includes("?") ? "&" : "?"}payment=error`);
  redirect(target);
}

export async function completeSandboxPaymentAction(paymentId: string, outcome: "success" | "cancel") {
  if (!isSandboxEnabled()) redirect("/payments");
  const user = await requireUser();
  const payment = await db.payment.findFirst({ where: { id: paymentId, userId: user.id } });
  if (!payment) redirect("/payments");

  if (outcome === "success") await markPaymentPaid(payment.id, `SANDBOX-${randomToken(6).toUpperCase()}`);
  else await markPaymentFailed(payment.id, "CANCELLED");

  redirect(paymentReturnPath(payment));
}
