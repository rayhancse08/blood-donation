import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClearCartOnMount } from "@/components/pharmacy/CartWidgets";
import { Alert, Badge, buttonClass, Card, cn, KeyValue, PageContainer, PageHeader } from "@/components/ui";
import { cancelOrderAction } from "@/lib/actions/pharmacy";
import { retryPaymentAction } from "@/lib/actions/payments";
import { requireUser } from "@/lib/auth";
import { ORDER_STATUS_TONE, orderStatusLabel, orderTimeline, PAYMENT_STATUS_TONE, paymentMethodLabel } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDateTime, one } from "@/lib/format";
import { formatTaka } from "@/lib/money";
import { fileUrl } from "@/lib/storage";

export const metadata: Metadata = { title: "Order" };

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const [{ id }, query] = await Promise.all([params, searchParams]);

  const order = await db.order.findFirst({
    where: { id, ...(user.role === "ADMIN" ? {} : { userId: user.id }) },
    include: { items: true, payment: true, pharmacy: { select: { id: true, name: true, phone: true, address: true } } },
  });
  if (!order) notFound();

  const timeline = orderTimeline(order.fulfillment);
  const currentIndex = timeline.indexOf(order.status as (typeof timeline)[number]);

  return (
    <PageContainer className="max-w-3xl space-y-6">
      {one(query.placed) === "1" && <ClearCartOnMount />}
      {one(query.placed) === "1" && order.payment?.status !== "PENDING" && (
        <Alert tone="success">Your order has been placed. The pharmacy will confirm it shortly.</Alert>
      )}
      {one(query.payment) === "error" && (
        <Alert tone="error">We could not start the payment. Your order is saved; you can retry payment below.</Alert>
      )}

      <PageHeader
        title={`Order ${order.orderNo}`}
        description={`${order.pharmacy.name} · placed ${formatDateTime(order.createdAt)}`}
        actions={<Badge tone={ORDER_STATUS_TONE[order.status]}>{orderStatusLabel(order.status)}</Badge>}
      />

      {order.status !== "CANCELLED" && (
        <Card title="Tracking">
          <ol className="grid gap-2 sm:grid-flow-col sm:auto-cols-fr">
            {timeline.map((step, index) => (
              <li key={step} className="flex items-center gap-2 sm:flex-col sm:text-center">
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                    index <= currentIndex ? "bg-red-600 text-white" : "bg-gray-200 text-gray-500",
                  )}
                >
                  {index + 1}
                </span>
                <span className={cn("text-xs", index <= currentIndex ? "font-semibold text-gray-900" : "text-gray-500")}>{orderStatusLabel(step)}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <Card title="Items">
        <ul className="divide-y divide-gray-100 text-sm">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3 py-2">
              <span className="min-w-0 break-words">
                {item.name} × {item.quantity}
              </span>
              <span className="shrink-0">{formatTaka(item.unitPrice * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 border-t border-gray-100 pt-3">
          <KeyValue label="Subtotal">{formatTaka(order.subtotal)}</KeyValue>
          {order.discount > 0 && <KeyValue label="Partner discount">-{formatTaka(order.discount)}</KeyValue>}
          {order.deliveryFee > 0 && <KeyValue label="Delivery fee">{formatTaka(order.deliveryFee)}</KeyValue>}
          <KeyValue label="Total">{formatTaka(order.total)}</KeyValue>
        </dl>
      </Card>

      <Card title="Delivery & payment">
        <dl>
          <KeyValue label="Method">{order.fulfillment === "DELIVERY" ? "Home delivery" : "Pharmacy pickup"}</KeyValue>
          {order.deliveryAddress && <KeyValue label="Address">{order.deliveryAddress}</KeyValue>}
          {order.fulfillment === "PICKUP" && <KeyValue label="Pickup from">{order.pharmacy.address ?? order.pharmacy.name}</KeyValue>}
          <KeyValue label="Contact">{order.contactPhone}</KeyValue>
          <KeyValue label="Payment">{paymentMethodLabel(order.paymentMethod)}</KeyValue>
          {order.payment && (
            <KeyValue label="Payment status">
              <Badge tone={PAYMENT_STATUS_TONE[order.payment.status]}>{order.payment.status.toLowerCase()}</Badge>
            </KeyValue>
          )}
          {order.prescriptionKey && (
            <KeyValue label="Prescription">
              <a href={fileUrl(order.prescriptionKey)!} target="_blank" className="text-red-600 hover:underline">
                View
              </a>
            </KeyValue>
          )}
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          {order.payment?.status === "PENDING" && order.status !== "CANCELLED" && (
            <form action={retryPaymentAction.bind(null, order.payment.id)}>
              <button type="submit" className={buttonClass.primary}>
                Pay {formatTaka(order.payment.total)} now
              </button>
            </form>
          )}
          {order.payment?.status === "PAID" && (
            <Link href={`/payments/${order.payment.id}`} className={buttonClass.secondary}>
              View receipt
            </Link>
          )}
          {order.pharmacy.phone && (
            <a href={`tel:${order.pharmacy.phone}`} className={buttonClass.secondary}>
              Call pharmacy
            </a>
          )}
          {order.status === "PENDING" && order.userId === user.id && (
            <form action={cancelOrderAction.bind(null, order.id)}>
              <button type="submit" className={buttonClass.danger}>
                Cancel order
              </button>
            </form>
          )}
        </div>
      </Card>
    </PageContainer>
  );
}
