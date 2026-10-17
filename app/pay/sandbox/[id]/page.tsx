import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert, buttonClass, Card, KeyValue, PageContainer } from "@/components/ui";
import { completeSandboxPaymentAction } from "@/lib/actions/payments";
import { requireUser } from "@/lib/auth";
import { paymentMethodLabel } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatTaka } from "@/lib/money";
import { isSandboxEnabled } from "@/lib/payments";

export const metadata: Metadata = { title: "Payment" };

export default async function SandboxPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!isSandboxEnabled()) notFound();

  const payment = await db.payment.findFirst({
    where: { id, userId: user.id },
    include: { facility: { select: { name: true } } },
  });
  if (!payment) notFound();

  return (
    <PageContainer className="max-w-md">
      <Card title={`${paymentMethodLabel(payment.method)} checkout`}>
        <Alert tone="warning">
          Test payment gateway. Configure live gateway credentials (e.g. bKash) to accept real payments.
        </Alert>
        <dl className="my-4">
          <KeyValue label="Pay to">{payment.facility?.name ?? "Blood App"}</KeyValue>
          <KeyValue label="Description">{payment.description}</KeyValue>
          <KeyValue label="Amount">{formatTaka(payment.amount)}</KeyValue>
          {payment.discount > 0 && <KeyValue label="Discount">-{formatTaka(payment.discount)}</KeyValue>}
          <KeyValue label="Total">{formatTaka(payment.total)}</KeyValue>
          <KeyValue label="Invoice">{payment.receiptNo}</KeyValue>
        </dl>
        {payment.status === "PENDING" ? (
          <div className="flex gap-2">
            <form action={completeSandboxPaymentAction.bind(null, payment.id, "success")} className="flex-1">
              <button type="submit" className={`${buttonClass.success} w-full`}>
                Confirm payment
              </button>
            </form>
            <form action={completeSandboxPaymentAction.bind(null, payment.id, "cancel")}>
              <button type="submit" className={buttonClass.secondary}>
                Cancel
              </button>
            </form>
          </div>
        ) : (
          <p className="text-sm text-gray-600">This payment is already {payment.status.toLowerCase()}.</p>
        )}
      </Card>
    </PageContainer>
  );
}
