import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { executeBkashPayment, markPaymentFailed, markPaymentPaid, paymentReturnPath } from "@/lib/payments";
import { appUrl } from "@/lib/url";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const paymentId = params.get("pid");
  const paymentID = params.get("paymentID");
  const status = params.get("status");

  if (!paymentId) return NextResponse.redirect(appUrl("/payments"));
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return NextResponse.redirect(appUrl("/payments"));

  const destination = appUrl(paymentReturnPath(payment));
  if (payment.status !== "PENDING") return NextResponse.redirect(destination);

  if (status !== "success" || !paymentID || paymentID !== payment.gatewayRef) {
    await markPaymentFailed(payment.id, status === "cancel" ? "CANCELLED" : "FAILED");
    return NextResponse.redirect(destination);
  }

  try {
    const result = await executeBkashPayment(paymentID);
    if (result.transactionStatus === "Completed" && result.trxID) {
      await markPaymentPaid(payment.id, result.trxID);
    } else {
      console.error("[bkash] execute failed", result.statusMessage);
      await markPaymentFailed(payment.id, "FAILED");
    }
  } catch (error) {
    console.error("[bkash] execute error", error);
    await markPaymentFailed(payment.id, "FAILED");
  }

  return NextResponse.redirect(destination);
}
