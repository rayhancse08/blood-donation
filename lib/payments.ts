import type { Payment } from "@/generated/prisma/client";
import { db } from "./db";
import { formatTaka } from "./money";
import { notifyUsers } from "./notify";
import { appUrl } from "./url";

const bkash = {
  baseUrl: process.env.BKASH_BASE_URL ?? "https://tokenized.sandbox.bka.sh/v1.2.0-beta",
  appKey: process.env.BKASH_APP_KEY ?? "",
  appSecret: process.env.BKASH_APP_SECRET ?? "",
  username: process.env.BKASH_USERNAME ?? "",
  password: process.env.BKASH_PASSWORD ?? "",
};

export function isBkashConfigured() {
  return !!(bkash.appKey && bkash.appSecret && bkash.username && bkash.password);
}

export function isSandboxEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.PAYMENT_SANDBOX === "true";
}

async function bkashToken() {
  const response = await fetch(`${bkash.baseUrl}/tokenized/checkout/token/grant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      username: bkash.username,
      password: bkash.password,
    },
    body: JSON.stringify({ app_key: bkash.appKey, app_secret: bkash.appSecret }),
  });
  const data = (await response.json()) as { id_token?: string; statusMessage?: string };
  if (!data.id_token) throw new Error(`bKash token grant failed: ${data.statusMessage ?? response.status}`);
  return data.id_token;
}

async function bkashRequest<T>(path: string, body: Record<string, string>) {
  const token = await bkashToken();
  const response = await fetch(`${bkash.baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: token,
      "X-App-Key": bkash.appKey,
    },
    body: JSON.stringify(body),
  });
  return (await response.json()) as T;
}

/** Returns the URL the user should be redirected to in order to pay. */
export async function startCheckout(payment: Payment): Promise<string> {
  if (payment.method === "BKASH" && isBkashConfigured()) {
    const data = await bkashRequest<{ bkashURL?: string; paymentID?: string; statusMessage?: string }>(
      "/tokenized/checkout/create",
      {
        mode: "0011",
        payerReference: payment.userId,
        callbackURL: appUrl(`/api/payments/bkash/callback?pid=${payment.id}`),
        amount: (payment.total / 100).toFixed(2),
        currency: "BDT",
        intent: "sale",
        merchantInvoiceNumber: payment.receiptNo,
      },
    );
    if (!data.bkashURL || !data.paymentID) throw new Error(`bKash create payment failed: ${data.statusMessage}`);
    await db.payment.update({ where: { id: payment.id }, data: { gatewayRef: data.paymentID } });
    return data.bkashURL;
  }

  if (!isSandboxEnabled()) {
    throw new Error(`No live gateway is configured for ${payment.method}`);
  }
  return `/pay/sandbox/${payment.id}`;
}

export async function executeBkashPayment(paymentID: string) {
  return bkashRequest<{ transactionStatus?: string; trxID?: string; statusMessage?: string }>(
    "/tokenized/checkout/execute",
    { paymentID },
  );
}

export function paymentReturnPath(payment: Pick<Payment, "id" | "orderId">) {
  return payment.orderId ? `/orders/${payment.orderId}?placed=1` : `/payments/${payment.id}`;
}

export async function markPaymentPaid(paymentId: string, transactionId: string) {
  const updated = await db.payment.updateMany({
    where: { id: paymentId, status: "PENDING" },
    data: { status: "PAID", transactionId, paidAt: new Date() },
  });
  if (updated.count === 0) return;

  const payment = await db.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: { facility: { select: { name: true, ownerId: true } } },
  });

  await notifyUsers([payment.userId], {
    type: "PAYMENT",
    title: "Payment successful",
    body: `${formatTaka(payment.total)} paid${payment.facility ? ` to ${payment.facility.name}` : ""}. Receipt ${payment.receiptNo}.`,
    link: `/payments/${payment.id}`,
  });

  if (payment.facility?.ownerId) {
    await notifyUsers([payment.facility.ownerId], {
      type: "PAYMENT",
      title: "Payment received",
      body: `${formatTaka(payment.total)} received (receipt ${payment.receiptNo}).`,
      link: `/partner/${payment.facilityId}`,
    });
  }
}

export async function markPaymentFailed(paymentId: string, status: "FAILED" | "CANCELLED") {
  await db.payment.updateMany({ where: { id: paymentId, status: "PENDING" }, data: { status } });
}
