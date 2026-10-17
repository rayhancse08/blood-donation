import type { Metadata } from "next";
import Link from "next/link";
import type { PaymentStatus } from "@/generated/prisma/client";
import { Badge, Card, PageHeader, Stat, Tabs } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { PAYMENT_STATUS_TONE, paymentMethodLabel } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDateTime, one } from "@/lib/format";
import { formatTaka } from "@/lib/money";

export const metadata: Metadata = { title: "Payment reports" };

const STATUSES: PaymentStatus[] = ["PAID", "PENDING", "FAILED", "CANCELLED", "REFUNDED"];

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const statusParam = one((await searchParams).status);
  const status = STATUSES.find((s) => s === statusParam);

  const [totals, byMethod, byFacility, payments] = await Promise.all([
    db.payment.aggregate({ where: { status: "PAID" }, _sum: { amount: true, discount: true, total: true }, _count: true }),
    db.payment.groupBy({ by: ["method"], where: { status: "PAID" }, _sum: { total: true }, _count: { _all: true } }),
    db.payment.groupBy({
      by: ["facilityId"],
      where: { status: "PAID", facilityId: { not: null } },
      _sum: { total: true, discount: true },
      _count: { _all: true },
      orderBy: { _sum: { total: "desc" } },
      take: 20,
    }),
    db.payment.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { name: true, phone: true } }, facility: { select: { name: true } } },
    }),
  ]);

  const facilityNames = new Map(
    (
      await db.facility.findMany({
        where: { id: { in: byFacility.map((f) => f.facilityId!).filter(Boolean) } },
        select: { id: true, name: true },
      })
    ).map((f) => [f.id, f.name]),
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Payments & discounts" description="Transaction reports for medicine orders and partner services." />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Successful payments" value={totals._count} />
        <Stat label="Gross amount" value={formatTaka(totals._sum.amount ?? 0)} />
        <Stat label="Discounts given" value={formatTaka(totals._sum.discount ?? 0)} />
        <Stat label="Collected" value={formatTaka(totals._sum.total ?? 0)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="By payment method">
          <ul className="divide-y divide-gray-100 text-sm">
            {byMethod.length === 0 && <li className="py-2 text-gray-500">No payments yet.</li>}
            {byMethod.map((m) => (
              <li key={m.method} className="flex justify-between py-2">
                <span>
                  {paymentMethodLabel(m.method)} <span className="text-gray-500">({m._count._all})</span>
                </span>
                <strong>{formatTaka(m._sum.total ?? 0)}</strong>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Top partners">
          <ul className="divide-y divide-gray-100 text-sm">
            {byFacility.length === 0 && <li className="py-2 text-gray-500">No partner payments yet.</li>}
            {byFacility.map((f) => (
              <li key={f.facilityId} className="flex justify-between gap-2 py-2">
                <span>
                  {facilityNames.get(f.facilityId!) ?? "Unknown"} <span className="text-gray-500">({f._count._all})</span>
                </span>
                <span className="text-right">
                  <strong>{formatTaka(f._sum.total ?? 0)}</strong>
                  <span className="block text-xs text-gray-500">{formatTaka(f._sum.discount ?? 0)} discounts</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div>
        <Tabs
          active={status ?? "all"}
          items={[
            { key: "all", label: "All", href: "/admin/payments" },
            ...STATUSES.map((s) => ({ key: s, label: s.charAt(0) + s.slice(1).toLowerCase(), href: `/admin/payments?status=${s}` })),
          ]}
        />
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Receipt</th>
                <th>Payer</th>
                <th>Provider</th>
                <th>Method</th>
                <th>Total</th>
                <th>Status</th>
                <th className="px-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <Link href={`/payments/${p.id}`} className="font-mono text-xs hover:underline">
                      {p.receiptNo}
                    </Link>
                    <p className="text-xs text-gray-500">{p.purpose === "MEDICINE_ORDER" ? "Medicine order" : (p.description ?? "Service")}</p>
                  </td>
                  <td>
                    {p.user.name ?? "—"}
                    <p className="text-xs text-gray-500">{p.user.phone}</p>
                  </td>
                  <td>{p.facility?.name ?? "—"}</td>
                  <td>{paymentMethodLabel(p.method)}</td>
                  <td>
                    {formatTaka(p.total)}
                    {p.discount > 0 && <p className="text-xs text-green-700">−{formatTaka(p.discount)}</p>}
                  </td>
                  <td>
                    <Badge tone={PAYMENT_STATUS_TONE[p.status]}>{p.status.toLowerCase()}</Badge>
                  </td>
                  <td className="px-4 text-xs">{formatDateTime(p.paidAt ?? p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {payments.length === 0 && <p className="p-6 text-center text-sm text-gray-500">No payments found.</p>}
        </div>
      </div>
    </div>
  );
}
