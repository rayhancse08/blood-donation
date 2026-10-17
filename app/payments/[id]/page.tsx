import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { Badge, buttonClass, KeyValue, PageContainer } from "@/components/ui";
import { retryPaymentAction } from "@/lib/actions/payments";
import { requireUser } from "@/lib/auth";
import { PAYMENT_STATUS_TONE, paymentMethodLabel } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { formatTaka } from "@/lib/money";

export const metadata: Metadata = { title: "Receipt" };

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const payment = await db.payment.findFirst({
    where: { id, ...(user.role === "ADMIN" ? {} : { userId: user.id }) },
    include: {
      facility: { select: { name: true, address: true, phone: true } },
      order: { select: { id: true, orderNo: true } },
      user: { select: { name: true, phone: true, email: true } },
    },
  });
  if (!payment) notFound();

  return (
    <PageContainer className="max-w-xl">
      <div className="mb-4 flex justify-between gap-2">
        <Link href="/payments" className={`${buttonClass.ghost} no-print`}>
          ← All payments
        </Link>
        <PrintButton label="Print receipt" />
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-lg font-bold text-red-600">Blood App</p>
            <p className="text-xs text-gray-500">Payment receipt</p>
          </div>
          <Badge tone={PAYMENT_STATUS_TONE[payment.status]}>{payment.status.toLowerCase()}</Badge>
        </div>
        <p className="mt-6 text-3xl font-extrabold">{formatTaka(payment.total)}</p>
        <dl className="mt-6">
          <KeyValue label="Receipt no.">{payment.receiptNo}</KeyValue>
          <KeyValue label="Paid by">{payment.user.name ?? payment.user.phone ?? payment.user.email}</KeyValue>
          <KeyValue label="Paid to">{payment.facility?.name ?? "—"}</KeyValue>
          <KeyValue label="Description">{payment.description ?? "—"}</KeyValue>
          {payment.order && (
            <KeyValue label="Order">
              <Link href={`/orders/${payment.order.id}`} className="text-red-600 hover:underline">
                {payment.order.orderNo}
              </Link>
            </KeyValue>
          )}
          <KeyValue label="Amount">{formatTaka(payment.amount)}</KeyValue>
          <KeyValue label="Discount">-{formatTaka(payment.discount)}</KeyValue>
          <KeyValue label="Total">{formatTaka(payment.total)}</KeyValue>
          <KeyValue label="Method">{paymentMethodLabel(payment.method)}</KeyValue>
          <KeyValue label="Transaction ID">{payment.transactionId ?? "—"}</KeyValue>
          <KeyValue label="Created">{formatDateTime(payment.createdAt)}</KeyValue>
          <KeyValue label="Paid at">{formatDateTime(payment.paidAt)}</KeyValue>
        </dl>
        {payment.status === "PENDING" && payment.userId === user.id && (
          <form action={retryPaymentAction.bind(null, payment.id)} className="no-print mt-6">
            <button type="submit" className={`${buttonClass.primary} w-full`}>
              Complete payment
            </button>
          </form>
        )}
      </div>
    </PageContainer>
  );
}
