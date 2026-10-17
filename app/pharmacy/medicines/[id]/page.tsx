import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartButton, CartBar } from "@/components/pharmacy/CartWidgets";
import { Alert, Badge, Card, EmptyState, PageContainer } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { distanceBetween, formatDistance, userOrigin } from "@/lib/geo";
import { calculateDiscount, formatTaka } from "@/lib/money";

export const metadata: Metadata = { title: "Medicine" };

export default async function MedicinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const origin = userOrigin(user);

  const medicine = await db.medicine.findUnique({
    where: { id },
    include: {
      stock: {
        where: { quantity: { gt: 0 }, pharmacy: { isActive: true, type: "PHARMACY" } },
        include: {
          pharmacy: {
            select: { id: true, name: true, district: true, address: true, latitude: true, longitude: true, partnerStatus: true, discountPercent: true },
          },
        },
      },
    },
  });
  if (!medicine) notFound();

  const offers = medicine.stock
    .map((s) => {
      const discountPercent = s.pharmacy.partnerStatus === "APPROVED" ? s.pharmacy.discountPercent : 0;
      return {
        ...s,
        discountPercent,
        finalPrice: calculateDiscount(s.price, discountPercent).total,
        distanceKm: distanceBetween(origin, s.pharmacy.latitude, s.pharmacy.longitude),
      };
    })
    .sort((a, b) => (a.distanceKm ?? 99999) - (b.distanceKm ?? 99999) || a.finalPrice - b.finalPrice);

  return (
    <PageContainer className="max-w-4xl space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-bold">
            {medicine.name} <span className="text-xl font-normal text-gray-500">{medicine.strength}</span>
          </h1>
          {medicine.requiresPrescription ? <Badge tone="orange">Prescription required</Badge> : <Badge tone="green">OTC</Badge>}
        </div>
        <p className="mt-1 text-gray-600">
          {medicine.genericName}
          {medicine.form ? ` · ${medicine.form}` : ""}
          {medicine.manufacturer ? ` · ${medicine.manufacturer}` : ""}
        </p>
        {medicine.description && <p className="mt-4 text-gray-700">{medicine.description}</p>}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {medicine.usage && (
            <div>
              <p className="text-sm font-semibold">Common use</p>
              <p className="text-sm text-gray-700">{medicine.usage}</p>
            </div>
          )}
          {medicine.sideEffects && (
            <div>
              <p className="text-sm font-semibold">Possible side effects</p>
              <p className="text-sm text-gray-700">{medicine.sideEffects}</p>
            </div>
          )}
        </div>
        <div className="mt-4">
          <Alert tone="info">
            This information is general. Always follow your doctor&apos;s prescription and read the package leaflet. Have a question?{" "}
            <Link href="/assistant" className="underline">Ask the AI assistant</Link>.
          </Alert>
        </div>
      </div>

      <Card title={`Available at ${offers.length} pharmac${offers.length === 1 ? "y" : "ies"}`}>
        {offers.length === 0 ? (
          <EmptyState title="Not in stock nearby" description="No partner pharmacy currently lists this medicine in stock." />
        ) : (
          <ul className="divide-y divide-gray-100">
            {offers.map((offer) => (
              <li key={offer.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/directory/${offer.pharmacy.id}`} className="font-medium hover:underline">
                    {offer.pharmacy.name}
                  </Link>
                  <p className="text-xs text-gray-500">
                    {offer.pharmacy.address ?? offer.pharmacy.district}
                    {offer.distanceKm != null && ` · ${formatDistance(offer.distanceKm)}`} · {offer.quantity} in stock
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatTaka(offer.finalPrice)}</p>
                  {offer.discountPercent > 0 && (
                    <p className="text-xs text-gray-500">
                      <span className="line-through">{formatTaka(offer.price)}</span> {offer.discountPercent}% off
                    </p>
                  )}
                </div>
                <AddToCartButton
                  pharmacy={{ id: offer.pharmacy.id, name: offer.pharmacy.name, discountPercent: offer.discountPercent }}
                  medicine={{
                    medicineId: medicine.id,
                    name: `${medicine.name}${medicine.strength ? ` ${medicine.strength}` : ""}`,
                    price: offer.price,
                    maxQuantity: Math.min(offer.quantity, 100),
                    requiresPrescription: medicine.requiresPrescription,
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <CartBar />
    </PageContainer>
  );
}
