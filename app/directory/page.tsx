import type { Metadata } from "next";
import Link from "next/link";
import type { FacilityType, Prisma } from "@/generated/prisma/client";
import { LocationFields } from "@/components/LocationFields";
import { Badge, buttonClass, EmptyState, Field, inputClass, PageContainer, PageHeader, Tabs } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { FACILITY_TYPES, facilityTypeLabel } from "@/lib/constants";
import { db } from "@/lib/db";
import { one } from "@/lib/format";
import { distanceBetween, formatDistance, userOrigin } from "@/lib/geo";
import { formatTaka } from "@/lib/money";

export const metadata: Metadata = { title: "Healthcare directory" };

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const origin = userOrigin(user);

  const tab = one(params.tab) === "doctors" ? "doctors" : "facilities";
  const q = one(params.q).trim();
  const type = one(params.type);
  const division = one(params.division);
  const district = one(params.district);
  const speciality = one(params.speciality).trim();
  const validType = FACILITY_TYPES.some((t) => t.value === type) ? (type as FacilityType) : null;

  const locationWhere = { ...(division ? { division } : {}), ...(district ? { district } : {}) };

  const facilities =
    tab === "facilities"
      ? await db.facility.findMany({
          where: {
            isActive: true,
            ...locationWhere,
            ...(validType ? { type: validType } : {}),
            ...(q
              ? {
                  OR: [
                    { name: { contains: q, mode: "insensitive" } },
                    { address: { contains: q, mode: "insensitive" } },
                    { services: { has: q } },
                  ],
                }
              : {}),
          } satisfies Prisma.FacilityWhereInput,
          take: 200,
        })
      : [];

  const doctors =
    tab === "doctors"
      ? await db.doctor.findMany({
          where: {
            isActive: true,
            ...locationWhere,
            ...(speciality ? { speciality: { contains: speciality, mode: "insensitive" } } : {}),
            ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { chamberName: { contains: q, mode: "insensitive" } }] } : {}),
          } satisfies Prisma.DoctorWhereInput,
          include: { facility: { select: { id: true, name: true } } },
          take: 200,
        })
      : [];

  const sortedFacilities = facilities
    .map((f) => ({ ...f, distanceKm: distanceBetween(origin, f.latitude, f.longitude) }))
    .sort((a, b) => (a.distanceKm ?? 99999) - (b.distanceKm ?? 99999) || a.name.localeCompare(b.name));
  const sortedDoctors = doctors
    .map((d) => ({ ...d, distanceKm: distanceBetween(origin, d.latitude, d.longitude) }))
    .sort((a, b) => (a.distanceKm ?? 99999) - (b.distanceKm ?? 99999) || a.name.localeCompare(b.name));

  return (
    <PageContainer>
      <PageHeader
        title="Healthcare directory"
        description="Hospitals, clinics, diagnostic centers, doctors, pharmacies, ambulances, donation centers and blood banks near you."
        actions={
          <Link href="/partner" className={buttonClass.secondary}>
            List your facility
          </Link>
        }
      />

      <Tabs
        active={tab}
        items={[
          { key: "facilities", label: "Facilities", href: "/directory" },
          { key: "doctors", label: "Doctors", href: "/directory?tab=doctors" },
        ]}
      />

      <form className="mb-6 grid gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <input type="hidden" name="tab" value={tab} />
        <Field label="Search">
          <input name="q" defaultValue={q} placeholder={tab === "doctors" ? "Doctor or chamber name" : "Name, area or service"} className={inputClass} />
        </Field>
        {tab === "facilities" ? (
          <Field label="Type">
            <select name="type" defaultValue={validType ?? ""} className={inputClass}>
              <option value="">All types</option>
              {FACILITY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Speciality">
            <input name="speciality" defaultValue={speciality} placeholder="e.g. Cardiology" className={inputClass} />
          </Field>
        )}
        <LocationFields filterMode showUpazilaThana={false} defaults={{ division, district }} />
        <button type="submit" className={buttonClass.dark}>
          Search
        </button>
      </form>

      {tab === "facilities" ? (
        sortedFacilities.length === 0 ? (
          <EmptyState title="No facilities found" description="Try a different search or area." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sortedFacilities.map((f) => (
              <div key={f.id} className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap gap-1">
                  <Badge tone="blue">{facilityTypeLabel(f.type)}</Badge>
                  {f.is24Hours && <Badge tone="green">24 hours</Badge>}
                  {f.partnerStatus === "APPROVED" && f.discountPercent > 0 && <Badge tone="red">{f.discountPercent}% off in app</Badge>}
                </div>
                <Link href={`/directory/${f.id}`} className="mt-2 font-semibold hover:underline">
                  {f.name}
                </Link>
                <p className="text-sm text-gray-600">{f.address ?? [f.upazila, f.district].filter(Boolean).join(", ")}</p>
                {f.distanceKm != null && <p className="text-xs text-gray-500">{formatDistance(f.distanceKm)} away</p>}
                <div className="mt-auto flex gap-2 pt-3">
                  {f.phone && (
                    <a href={`tel:${f.phone}`} className={f.type === "AMBULANCE" ? buttonClass.success : buttonClass.secondary}>
                      Call
                    </a>
                  )}
                  <Link href={`/directory/${f.id}`} className={buttonClass.ghost}>
                    Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )
      ) : sortedDoctors.length === 0 ? (
        <EmptyState title="No doctors found" description="Try a different search or area." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedDoctors.map((d) => (
            <Link key={d.id} href={`/directory/doctors/${d.id}`} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md">
              <Badge tone="purple">{d.speciality}</Badge>
              <p className="mt-2 font-semibold">{d.name}</p>
              {d.qualifications && <p className="text-xs text-gray-500">{d.qualifications}</p>}
              <p className="mt-1 text-sm text-gray-600">{d.chamberName ?? d.facility?.name ?? d.chamberAddress}</p>
              <p className="text-xs text-gray-500">
                {d.visitingHours}
                {d.consultationFee != null && ` · Fee ${formatTaka(d.consultationFee)}`}
                {d.distanceKm != null && ` · ${formatDistance(d.distanceKm)}`}
              </p>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
