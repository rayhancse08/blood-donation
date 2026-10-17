import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert, Badge, buttonClass, Card, EmptyState, Field, inputClass, PageContainer, PageHeader, Stat, Tabs } from "@/components/ui";
import {
  createOfferAction,
  removeStockAction,
  toggleOfferAction,
  updateFacilityDetailsAction,
  upsertStockAction,
} from "@/lib/actions/partner";
import { updateOrderStatusAction } from "@/lib/actions/pharmacy";
import { requireUser } from "@/lib/auth";
import {
  facilityTypeLabel,
  labelOf,
  nextOrderStatuses,
  ORDER_STATUS_TONE,
  orderStatusLabel,
  PARTNER_STATUSES,
  PARTNER_STATUS_TONE,
  PAYMENT_STATUS_TONE,
  paymentMethodLabel,
} from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, one } from "@/lib/format";
import { formatTaka, toTaka } from "@/lib/money";
import { fileUrl } from "@/lib/storage";

export const metadata: Metadata = { title: "Manage facility" };

export default async function ManageFacilityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const [{ id }, query] = await Promise.all([params, searchParams]);

  const facility = await db.facility.findUnique({ where: { id } });
  if (!facility || (facility.ownerId !== user.id && user.role !== "ADMIN")) notFound();

  const isPharmacy = facility.type === "PHARMACY";
  const tabs = [
    { key: "overview", label: "Overview", href: `/partner/${id}` },
    ...(isPharmacy
      ? [
          { key: "orders", label: "Orders", href: `/partner/${id}?tab=orders` },
          { key: "stock", label: "Stock", href: `/partner/${id}?tab=stock` },
        ]
      : []),
    { key: "payments", label: "Payments", href: `/partner/${id}?tab=payments` },
    { key: "offers", label: "Donor offers", href: `/partner/${id}?tab=offers` },
  ];
  const tab = tabs.some((t) => t.key === one(query.tab)) ? one(query.tab) : "overview";

  const [paidAgg, pendingOrders] = await Promise.all([
    db.payment.aggregate({ where: { facilityId: id, status: "PAID" }, _sum: { total: true, discount: true }, _count: true }),
    db.order.count({ where: { pharmacyId: id, status: { in: ["PENDING", "CONFIRMED", "PREPARING"] } } }),
  ]);

  return (
    <PageContainer className="space-y-6">
      {one(query.applied) === "1" && (
        <Alert tone="success">Application received. Our team will verify your licence and activate your listing.</Alert>
      )}
      <PageHeader
        title={facility.name}
        description={`${facilityTypeLabel(facility.type)} · ${facility.district ?? ""}`}
        actions={
          <>
            <Badge tone={PARTNER_STATUS_TONE[facility.partnerStatus]}>{labelOf(PARTNER_STATUSES, facility.partnerStatus)}</Badge>
            {facility.isActive && (
              <Link href={`/directory/${facility.id}`} className={buttonClass.small}>
                Public page
              </Link>
            )}
          </>
        }
      />

      <Tabs items={tabs} active={tab} />

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="grid gap-4 lg:col-span-3 sm:grid-cols-3">
            <Stat label="Payments received" value={paidAgg._count} />
            <Stat label="Revenue via app" value={formatTaka(paidAgg._sum.total ?? 0)} />
            <Stat label="Discounts given" value={formatTaka(paidAgg._sum.discount ?? 0)} />
          </div>
          {isPharmacy && pendingOrders > 0 && (
            <div className="lg:col-span-3">
              <Alert tone="warning">
                You have {pendingOrders} order(s) in progress. <Link href={`/partner/${id}?tab=orders`} className="underline">Manage orders</Link>
              </Alert>
            </div>
          )}
          <Card title="Facility details" className="lg:col-span-2">
            <ActionForm action={updateFacilityDetailsAction.bind(null, id)}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Phone" required>
                  <input name="phone" defaultValue={facility.phone ?? ""} required className={inputClass} />
                </Field>
                <Field label="Email">
                  <input name="email" type="email" defaultValue={facility.email ?? ""} className={inputClass} />
                </Field>
                <Field label="Website">
                  <input name="website" type="url" defaultValue={facility.website ?? ""} className={inputClass} />
                </Field>
                <Field label="Opening hours">
                  <input name="openingHours" defaultValue={facility.openingHours ?? ""} className={inputClass} />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="is24Hours" defaultChecked={facility.is24Hours} /> Open 24 hours
              </label>
              <Field label="Address" required>
                <input name="address" defaultValue={facility.address ?? ""} required className={inputClass} />
              </Field>
              <Field label="Description">
                <textarea name="description" rows={3} defaultValue={facility.description ?? ""} className={inputClass} />
              </Field>
              <Field label="Services" hint="Comma separated">
                <input name="services" defaultValue={facility.services.join(", ")} className={inputClass} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Discount (%)" required>
                  <input name="discountPercent" type="number" min={0} max={50} defaultValue={facility.discountPercent} required className={inputClass} />
                </Field>
                <Field label="Discount terms" className="sm:col-span-2">
                  <input name="discountTerms" defaultValue={facility.discountTerms ?? ""} className={inputClass} />
                </Field>
              </div>
              <SubmitButton>Save details</SubmitButton>
            </ActionForm>
          </Card>
          <Card title="Verification">
            <div className="space-y-2 text-sm">
              <p>
                Licence: <strong>{facility.licenseNumber ?? "—"}</strong>
              </p>
              <p>Status: {facility.licenseVerified ? <Badge tone="green">Verified</Badge> : <Badge tone="yellow">Pending</Badge>}</p>
              {facility.licenseDocKey && (
                <a href={fileUrl(facility.licenseDocKey)!} target="_blank" className="text-red-600 hover:underline">
                  View uploaded document
                </a>
              )}
            </div>
          </Card>
        </div>
      )}

      {tab === "orders" && isPharmacy && <OrdersTab facilityId={id} />}
      {tab === "stock" && isPharmacy && <StockTab facilityId={id} />}
      {tab === "payments" && <PaymentsTab facilityId={id} />}
      {tab === "offers" && <OffersTab facilityId={id} approved={facility.partnerStatus === "APPROVED"} />}
    </PageContainer>
  );
}

async function OrdersTab({ facilityId }: { facilityId: string }) {
  const orders = await db.order.findMany({
    where: { pharmacyId: facilityId },
    orderBy: { createdAt: "desc" },
    include: { items: true, payment: { select: { status: true } }, user: { select: { name: true } } },
    take: 100,
  });

  if (orders.length === 0) return <EmptyState title="No orders yet" />;

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <Card
          key={order.id}
          title={
            <span>
              {order.orderNo} <span className="text-sm font-normal text-gray-500">· {formatDateTime(order.createdAt)}</span>
            </span>
          }
          actions={<Badge tone={ORDER_STATUS_TONE[order.status]}>{orderStatusLabel(order.status)}</Badge>}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <ul className="text-sm">
              {order.items.map((item) => (
                <li key={item.id}>
                  {item.name} × {item.quantity} = {formatTaka(item.unitPrice * item.quantity)}
                </li>
              ))}
              <li className="mt-2 font-semibold">Total {formatTaka(order.total)}</li>
            </ul>
            <div className="space-y-1 text-sm">
              <p>
                <strong>{order.user.name}</strong> · {order.contactPhone}
              </p>
              <p>{order.fulfillment === "DELIVERY" ? `Deliver to: ${order.deliveryAddress}` : "Customer will pick up"}</p>
              <p>
                Payment: {paymentMethodLabel(order.paymentMethod)}
                {order.payment && (
                  <>
                    {" "}
                    <Badge tone={PAYMENT_STATUS_TONE[order.payment.status]}>{order.payment.status.toLowerCase()}</Badge>
                  </>
                )}
              </p>
              {order.note && <p className="text-gray-600">Note: {order.note}</p>}
              {order.prescriptionKey && (
                <a href={fileUrl(order.prescriptionKey)!} target="_blank" className="text-red-600 hover:underline">
                  View prescription
                </a>
              )}
            </div>
          </div>
          {nextOrderStatuses(order.status, order.fulfillment).length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
              {nextOrderStatuses(order.status, order.fulfillment).map((status) => (
                <form key={status} action={updateOrderStatusAction.bind(null, order.id, status)}>
                  <button type="submit" className={status === "CANCELLED" ? buttonClass.danger : buttonClass.primary}>
                    {status === "CANCELLED" ? "Reject / cancel" : `Mark ${orderStatusLabel(status).toLowerCase()}`}
                  </button>
                </form>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

async function StockTab({ facilityId }: { facilityId: string }) {
  const [stock, medicines] = await Promise.all([
    db.pharmacyStock.findMany({
      where: { pharmacyId: facilityId },
      include: { medicine: true },
      orderBy: { medicine: { name: "asc" } },
    }),
    db.medicine.findMany({ select: { id: true, name: true, strength: true }, orderBy: { name: "asc" }, take: 1000 }),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card title="Add or update a medicine" className="lg:col-span-1">
        <ActionForm action={upsertStockAction.bind(null, facilityId)} resetOnSuccess>
          <Field label="From catalogue">
            <select name="medicineId" defaultValue="" className={inputClass}>
              <option value="">New medicine (fill below)</option>
              {medicines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.strength}
                </option>
              ))}
            </select>
          </Field>
          <details className="rounded-lg border border-gray-200 p-3">
            <summary className="cursor-pointer text-sm font-medium">New medicine details</summary>
            <div className="mt-3 space-y-3">
              <input name="name" placeholder="Brand name" className={inputClass} />
              <input name="genericName" placeholder="Generic name" className={inputClass} />
              <input name="strength" placeholder="Strength, e.g. 500 mg" className={inputClass} />
              <input name="form" placeholder="Form, e.g. Tablet" className={inputClass} />
              <input name="manufacturer" placeholder="Manufacturer" className={inputClass} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="requiresPrescription" /> Prescription only
              </label>
            </div>
          </details>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (Taka)" required>
              <input name="price" type="number" step="0.01" min={0.01} required className={inputClass} />
            </Field>
            <Field label="Quantity" required>
              <input name="quantity" type="number" min={0} required className={inputClass} />
            </Field>
          </div>
          <SubmitButton>Save stock</SubmitButton>
        </ActionForm>
      </Card>

      <Card title={`Stock (${stock.length})`} className="lg:col-span-2">
        {stock.length === 0 ? (
          <p className="text-sm text-gray-600">No medicines listed yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-gray-500">
              <tr>
                <th className="py-2">Medicine</th>
                <th className="text-right">Price</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Updated</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stock.map((s) => (
                <tr key={s.id}>
                  <td className="py-2">
                    {s.medicine.name} {s.medicine.strength}
                    {s.medicine.requiresPrescription && <Badge tone="orange">Rx</Badge>}
                  </td>
                  <td className="text-right">{toTaka(s.price).toFixed(2)}</td>
                  <td className={`text-right ${s.quantity === 0 ? "text-red-600" : ""}`}>{s.quantity}</td>
                  <td className="text-right text-xs text-gray-500">{formatDate(s.updatedAt)}</td>
                  <td className="text-right">
                    <form action={removeStockAction.bind(null, facilityId, s.id)}>
                      <button type="submit" className="text-xs text-red-600 hover:underline">
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

async function PaymentsTab({ facilityId }: { facilityId: string }) {
  const payments = await db.payment.findMany({
    where: { facilityId },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true } } },
    take: 200,
  });
  if (payments.length === 0) return <EmptyState title="No payments yet" />;

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th className="px-4 py-3">Date</th>
            <th>Receipt</th>
            <th>Customer</th>
            <th>Method</th>
            <th className="text-right">Amount</th>
            <th className="text-right">Discount</th>
            <th className="text-right">Total</th>
            <th className="px-4">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {payments.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-2">{formatDateTime(p.createdAt)}</td>
              <td className="font-mono text-xs">{p.receiptNo}</td>
              <td>{p.user.name}</td>
              <td>{paymentMethodLabel(p.method)}</td>
              <td className="text-right">{formatTaka(p.amount)}</td>
              <td className="text-right">{formatTaka(p.discount)}</td>
              <td className="text-right font-medium">{formatTaka(p.total)}</td>
              <td className="px-4">
                <Badge tone={PAYMENT_STATUS_TONE[p.status]}>{p.status.toLowerCase()}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function OffersTab({ facilityId, approved }: { facilityId: string; approved: boolean }) {
  const offers = await db.partnerOffer.findMany({ where: { facilityId }, orderBy: { createdAt: "desc" } });

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card title="Create an offer for donors" className="lg:col-span-1">
        {approved ? (
          <ActionForm action={createOfferAction.bind(null, facilityId)} resetOnSuccess>
            <Field label="Title" required>
              <input name="title" required maxLength={120} placeholder="e.g. Free health check-up" className={inputClass} />
            </Field>
            <Field label="Description" required>
              <textarea name="description" rows={2} required maxLength={500} className={inputClass} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Min. donations">
                <input name="minDonations" type="number" min={0} max={100} defaultValue={1} className={inputClass} />
              </Field>
              <Field label="Promo code">
                <input name="code" maxLength={40} className={inputClass} />
              </Field>
            </div>
            <Field label="Valid until">
              <input name="validUntil" type="date" className={inputClass} />
            </Field>
            <SubmitButton>Publish offer</SubmitButton>
          </ActionForm>
        ) : (
          <p className="text-sm text-gray-600">You can create donor offers once your partnership is approved.</p>
        )}
      </Card>
      <Card title="Your offers" className="lg:col-span-2">
        {offers.length === 0 ? (
          <p className="text-sm text-gray-600">No offers yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {offers.map((offer) => (
              <li key={offer.id} className="flex items-center gap-3 py-3">
                <div className="flex-1">
                  <p className="font-medium">{offer.title}</p>
                  <p className="text-xs text-gray-500">
                    {offer.description} · min {offer.minDonations} donation(s)
                    {offer.validUntil ? ` · until ${formatDate(offer.validUntil)}` : ""}
                  </p>
                </div>
                <Badge tone={offer.isActive ? "green" : "gray"}>{offer.isActive ? "Active" : "Paused"}</Badge>
                <form action={toggleOfferAction.bind(null, facilityId, offer.id)}>
                  <button type="submit" className={buttonClass.small}>
                    {offer.isActive ? "Pause" : "Activate"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
