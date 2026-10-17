import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartButton, CartBar } from "@/components/pharmacy/CartWidgets";
import { Badge, buttonClass, Card, KeyValue, PageContainer } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { facilityTypeLabel } from "@/lib/constants";
import { db } from "@/lib/db";
import { distanceBetween, formatDistance, mapsLink, userOrigin } from "@/lib/geo";
import { formatTaka } from "@/lib/money";

export const metadata: Metadata = { title: "Facility" };

export default async function FacilityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();

  const facility = await db.facility.findFirst({
    where: { id, OR: [{ isActive: true }, ...(user ? [{ ownerId: user.id }] : [])] },
    include: {
      doctors: { where: { isActive: true }, take: 20 },
      offers: { where: { isActive: true }, take: 10 },
      stock: {
        where: { quantity: { gt: 0 } },
        include: { medicine: true },
        orderBy: { medicine: { name: "asc" } },
        take: 100,
      },
    },
  });
  if (!facility) notFound();

  const distance = distanceBetween(userOrigin(user), facility.latitude, facility.longitude);
  const isPartner = facility.partnerStatus === "APPROVED";
  const discount = isPartner ? facility.discountPercent : 0;

  return (
    <PageContainer className="max-w-4xl space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap gap-1">
          <Badge tone="blue">{facilityTypeLabel(facility.type)}</Badge>
          {facility.is24Hours && <Badge tone="green">Open 24 hours</Badge>}
          {isPartner && <Badge tone="red">Partner{discount ? ` · ${discount}% discount` : ""}</Badge>}
          {facility.licenseVerified && <Badge tone="green">Licence verified</Badge>}
        </div>
        <h1 className="mt-2 break-words text-2xl font-bold sm:text-3xl">{facility.name}</h1>
        {facility.description && <p className="mt-2 text-gray-600">{facility.description}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          {facility.phone && (
            <a href={`tel:${facility.phone}`} className={buttonClass.success}>
              Call {facility.phone}
            </a>
          )}
          {facility.latitude != null && facility.longitude != null && (
            <a href={mapsLink(facility.latitude, facility.longitude)} target="_blank" rel="noopener noreferrer" className={buttonClass.secondary}>
              Directions
            </a>
          )}
          {isPartner && facility.type !== "PHARMACY" && (
            <Link href={`/pay?facility=${facility.id}`} className={buttonClass.primary}>
              Pay in app{discount ? ` (${discount}% off)` : ""}
            </Link>
          )}
        </div>

        <dl className="mt-6 grid gap-x-8 sm:grid-cols-2">
          <KeyValue label="Address">{facility.address ?? "—"}</KeyValue>
          <KeyValue label="Area">{[facility.thana, facility.upazila, facility.district, facility.division].filter(Boolean).join(", ") || "—"}</KeyValue>
          <KeyValue label="Opening hours">{facility.is24Hours ? "24 hours" : (facility.openingHours ?? "—")}</KeyValue>
          {distance != null && <KeyValue label="Distance">{formatDistance(distance)}</KeyValue>}
          {facility.email && <KeyValue label="Email">{facility.email}</KeyValue>}
          {facility.website && (
            <KeyValue label="Website">
              <a href={facility.website} target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline">
                Visit
              </a>
            </KeyValue>
          )}
        </dl>

        {facility.services.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1">
            {facility.services.map((service) => (
              <Badge key={service}>{service}</Badge>
            ))}
          </div>
        )}
        {isPartner && facility.discountTerms && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">Discount terms: {facility.discountTerms}</p>}
      </div>

      {facility.offers.length > 0 && (
        <Card title="Offers for blood donors">
          <ul className="space-y-2">
            {facility.offers.map((offer) => (
              <li key={offer.id} className="text-sm">
                <strong>{offer.title}</strong> - {offer.description}{" "}
                <span className="text-gray-500">(after {offer.minDonations} verified donation(s))</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {facility.doctors.length > 0 && (
        <Card title="Doctors">
          <ul className="divide-y divide-gray-100">
            {facility.doctors.map((doctor) => (
              <li key={doctor.id} className="py-2">
                <Link href={`/directory/doctors/${doctor.id}`} className="font-medium hover:underline">
                  {doctor.name}
                </Link>
                <p className="text-xs text-gray-500">
                  {doctor.speciality}
                  {doctor.visitingHours ? ` · ${doctor.visitingHours}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {facility.type === "PHARMACY" && (
        <Card title="Medicines in stock">
          {facility.stock.length === 0 ? (
            <p className="text-sm text-gray-600">This pharmacy has not listed any medicines yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {facility.stock.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                  <div className="min-w-0 basis-full sm:flex-1 sm:basis-0">
                    <Link href={`/pharmacy/medicines/${item.medicineId}`} className="font-medium hover:underline">
                      {item.medicine.name} {item.medicine.strength}
                    </Link>
                    <p className="text-xs text-gray-500">
                      {item.medicine.genericName}
                      {item.medicine.requiresPrescription && " · Prescription required"}
                    </p>
                  </div>
                  <p className="flex-1 font-semibold sm:w-24 sm:flex-none sm:text-right">{formatTaka(item.price)}</p>
                  {facility.isActive && (
                    <AddToCartButton
                      pharmacy={{ id: facility.id, name: facility.name, discountPercent: discount }}
                      medicine={{
                        medicineId: item.medicineId,
                        name: `${item.medicine.name}${item.medicine.strength ? ` ${item.medicine.strength}` : ""}`,
                        price: item.price,
                        maxQuantity: Math.min(item.quantity, 100),
                        requiresPrescription: item.medicine.requiresPrescription,
                      }}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
          <CartBar />
        </Card>
      )}
    </PageContainer>
  );
}
