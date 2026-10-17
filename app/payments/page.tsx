import type { Metadata } from "next";
import Link from "next/link";
import { Badge, buttonClass, EmptyState, PageContainer, PageHeader, Stat } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { PAYMENT_STATUS_TONE, paymentMethodLabel } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { formatTaka } from "@/lib/money";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage() {
  const user = await requireUser();
  const payments = await db.payment.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { facility: { select: { name: true } } },
    take: 200,
  });
  const paid = payments.filter((p) => p.status === "PAID");
  const totalPaid = paid.reduce((sum, p) => sum + p.total, 0);
  const totalSaved = paid.reduce((sum, p) => sum + p.discount, 0);

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        title="Payments"
        description="Your payment history and receipts."
        actions={
          <Link href="/pay" className={buttonClass.primary}>
            Pay a provider
          </Link>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Payments" value={paid.length} />
        <Stat label="Total paid" value={formatTaka(totalPaid)} />
        <Stat label="You saved" value={formatTaka(totalSaved)} hint="With partner discounts" />
      </div>
      {payments.length === 0 ? (
        <EmptyState title="No payments yet" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th>Paid to</th>
                <th>Method</th>
                <th className="text-right">Amount</th>
                <th className="px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <Link href={`/payments/${p.id}`} className="text-red-600 hover:underline">
                      {formatDateTime(p.createdAt)}
                    </Link>
                  </td>
                  <td>{p.facility?.name ?? "—"}</td>
                  <td>{paymentMethodLabel(p.method)}</td>
                  <td className="text-right font-medium">{formatTaka(p.total)}</td>
                  <td className="px-4">
                    <Badge tone={PAYMENT_STATUS_TONE[p.status]}>{p.status.toLowerCase()}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  );
}
