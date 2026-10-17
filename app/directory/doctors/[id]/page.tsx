import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, Badge, buttonClass, KeyValue, PageContainer } from "@/components/ui";
import { db } from "@/lib/db";
import { mapsLink } from "@/lib/geo";
import { formatTaka } from "@/lib/money";

export const metadata: Metadata = { title: "Doctor" };

export default async function DoctorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doctor = await db.doctor.findFirst({
    where: { id, isActive: true },
    include: { facility: { select: { id: true, name: true, phone: true, partnerStatus: true, discountPercent: true } } },
  });
  if (!doctor) notFound();

  return (
    <PageContainer className="max-w-3xl">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <Avatar name={doctor.name} src={doctor.photoUrl} size={72} />
          <div>
            <h1 className="text-2xl font-bold">{doctor.name}</h1>
            <Badge tone="purple">{doctor.speciality}</Badge>
            {doctor.qualifications && <p className="mt-1 text-sm text-gray-600">{doctor.qualifications}</p>}
          </div>
        </div>
        {doctor.bio && <p className="mt-4 text-gray-700">{doctor.bio}</p>}

        <h2 className="mt-6 text-lg font-semibold">Chamber</h2>
        <dl className="mt-2">
          <KeyValue label="Chamber">
            {doctor.facility ? (
              <Link href={`/directory/${doctor.facility.id}`} className="text-red-600 hover:underline">
                {doctor.facility.name}
              </Link>
            ) : (
              (doctor.chamberName ?? "—")
            )}
          </KeyValue>
          <KeyValue label="Address">{doctor.chamberAddress ?? "—"}</KeyValue>
          <KeyValue label="Area">{[doctor.district, doctor.division].filter(Boolean).join(", ") || "—"}</KeyValue>
          <KeyValue label="Visiting hours">{doctor.visitingHours ?? "—"}</KeyValue>
          {doctor.consultationFee != null && <KeyValue label="Consultation fee">{formatTaka(doctor.consultationFee)}</KeyValue>}
        </dl>

        <div className="mt-6 flex flex-wrap gap-2">
          {(doctor.phone ?? doctor.facility?.phone) && (
            <a href={`tel:${doctor.phone ?? doctor.facility?.phone}`} className={buttonClass.success}>
              Call for appointment
            </a>
          )}
          {doctor.latitude != null && doctor.longitude != null && (
            <a href={mapsLink(doctor.latitude, doctor.longitude)} target="_blank" rel="noopener noreferrer" className={buttonClass.secondary}>
              Directions
            </a>
          )}
          {doctor.facility?.partnerStatus === "APPROVED" && (
            <Link href={`/pay?facility=${doctor.facility.id}`} className={buttonClass.primary}>
              Pay consultation in app
              {doctor.facility.discountPercent ? ` (${doctor.facility.discountPercent}% off)` : ""}
            </Link>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
