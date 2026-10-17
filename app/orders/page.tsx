import type { Metadata } from "next";
import Link from "next/link";
import { Badge, buttonClass, EmptyState, PageContainer, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { ORDER_STATUS_TONE, orderStatusLabel } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { formatTaka } from "@/lib/money";

export const metadata: Metadata = { title: "My orders" };

export default async function OrdersPage() {
  const user = await requireUser();
  const orders = await db.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { pharmacy: { select: { name: true } }, _count: { select: { items: true } } },
    take: 100,
  });

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        title="My medicine orders"
        actions={
          <Link href="/pharmacy" className={buttonClass.primary}>
            Order medicine
          </Link>
        }
      />
      {orders.length === 0 ? (
        <EmptyState title="No orders yet" description="Order medicine from a nearby partner pharmacy." />
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link href={`/orders/${order.id}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md">
                <div className="min-w-0 flex-1">
                  <p className="break-words font-semibold">
                    {order.pharmacy.name} <span className="whitespace-nowrap font-mono text-xs text-gray-500">{order.orderNo}</span>
                  </p>
                  <p className="text-sm text-gray-600">
                    {order._count.items} item(s) · {order.fulfillment === "DELIVERY" ? "Home delivery" : "Pickup"} · {formatDateTime(order.createdAt)}
                  </p>
                </div>
                <p className="font-semibold">{formatTaka(order.total)}</p>
                <Badge tone={ORDER_STATUS_TONE[order.status]}>{orderStatusLabel(order.status)}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
