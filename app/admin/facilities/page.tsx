import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { ActionForm } from "@/components/ActionForm";
import { GeoInputs } from "@/components/GeoInputs";
import { LocationFields } from "@/components/LocationFields";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, buttonClass, Card, Field, inputClass, PageHeader, SelectOptions, Tabs } from "@/components/ui";
import { createFacilityAction, reviewPartnerAction, toggleFacilityActiveAction } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { FACILITY_TYPES, facilityTypeLabel, labelOf, PARTNER_STATUS_TONE, PARTNER_STATUSES } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDate, one } from "@/lib/format";
import { fileUrl } from "@/lib/storage";

export const metadata: Metadata = { title: "Facilities & partners" };

export default async function AdminFacilitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const tab = one(params.tab) === "pending" ? "pending" : one(params.tab) === "new" ? "new" : "all";
  const q = one(params.q).trim();

  const where: Prisma.FacilityWhereInput =
    tab === "pending"
      ? { partnerStatus: "PENDING" }
      : q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { district: { contains: q, mode: "insensitive" } },
            ],
          }
        : {};

  const facilities =
    tab === "new"
      ? []
      : await db.facility.findMany({
          where,
          orderBy: [{ partnerStatus: "asc" }, { createdAt: "desc" }],
          take: 100,
          include: { owner: { select: { name: true, phone: true, email: true } } },
        });

  return (
    <div>
      <PageHeader title="Facilities & partners" description="Directory listings and partner onboarding with licence verification." />
      <Tabs
        active={tab}
        items={[
          { key: "all", label: "All facilities", href: "/admin/facilities" },
          { key: "pending", label: "Partner applications", href: "/admin/facilities?tab=pending" },
          { key: "new", label: "Add facility", href: "/admin/facilities?tab=new" },
        ]}
      />

      {tab === "new" ? (
        <Card title="Add a facility to the directory">
          <ActionForm action={createFacilityAction} resetOnSuccess className="grid gap-4 sm:grid-cols-2">
            <Field label="Type" required>
              <select name="type" required className={inputClass}>
                <SelectOptions options={FACILITY_TYPES} />
              </select>
            </Field>
            <Field label="Name" required>
              <input name="name" required maxLength={150} className={inputClass} />
            </Field>
            <Field label="Phone">
              <input name="phone" maxLength={30} className={inputClass} />
            </Field>
            <Field label="Email">
              <input name="email" type="email" maxLength={150} className={inputClass} />
            </Field>
            <Field label="Website">
              <input name="website" type="url" maxLength={200} className={inputClass} />
            </Field>
            <Field label="Opening hours">
              <input name="openingHours" placeholder="e.g. 9am - 10pm" maxLength={100} className={inputClass} />
            </Field>
            <LocationFields />
            <Field label="Address" className="sm:col-span-2">
              <input name="address" maxLength={300} className={inputClass} />
            </Field>
            <Field label="Services (comma separated)" className="sm:col-span-2">
              <input name="services" placeholder="ICU, Blood bank, X-ray" maxLength={500} className={inputClass} />
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <textarea name="description" rows={3} maxLength={1000} className={inputClass} />
            </Field>
            <Field label="Discount for app users (%)">
              <input name="discountPercent" type="number" min={0} max={50} defaultValue={0} className={inputClass} />
            </Field>
            <Field label="Discount terms">
              <input name="discountTerms" maxLength={1000} className={inputClass} />
            </Field>
            <div className="flex flex-col gap-2 text-sm sm:col-span-2">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="is24Hours" /> Open 24 hours
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="partner" /> Approved partner (accepts in-app payments)
              </label>
            </div>
            <div className="sm:col-span-2">
              <GeoInputs label="Use my current location as the facility location" />
            </div>
            <div className="sm:col-span-2">
              <SubmitButton>Add facility</SubmitButton>
            </div>
          </ActionForm>
        </Card>
      ) : (
        <>
          {tab === "all" && (
            <form className="mb-4 flex gap-2">
              <input name="q" defaultValue={q} placeholder="Search by name or district" className={inputClass} />
              <button type="submit" className={buttonClass.dark}>
                Search
              </button>
            </form>
          )}
          <div className="space-y-3">
            {facilities.length === 0 && <p className="rounded-xl bg-white p-6 text-center text-sm text-gray-500">Nothing here.</p>}
            {facilities.map((f) => (
              <div key={f.id} className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/directory/${f.id}`} className="font-semibold hover:underline">
                      {f.name}
                    </Link>
                    <Badge tone="blue">{facilityTypeLabel(f.type)}</Badge>
                    {f.partnerStatus !== "NONE" && (
                      <Badge tone={PARTNER_STATUS_TONE[f.partnerStatus]}>{labelOf(PARTNER_STATUSES, f.partnerStatus)}</Badge>
                    )}
                    {!f.isActive && <Badge tone="gray">Hidden</Badge>}
                    {f.discountPercent > 0 && <Badge tone="green">{f.discountPercent}% off</Badge>}
                  </div>
                  <p className="text-xs text-gray-500">
                    {[f.address, f.district].filter(Boolean).join(", ") || "No address"} · {f.phone ?? "no phone"} · added {formatDate(f.createdAt)}
                  </p>
                  {f.owner && (
                    <p className="text-xs text-gray-500">
                      Owner: {f.owner.name ?? "—"} ({f.owner.phone ?? f.owner.email})
                    </p>
                  )}
                  {f.licenseNumber && (
                    <p className="text-xs text-gray-500">
                      Licence {f.licenseNumber}
                      {f.licenseDocKey && (
                        <>
                          {" · "}
                          <a href={fileUrl(f.licenseDocKey)!} target="_blank" className="text-red-600 hover:underline">
                            view document
                          </a>
                        </>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {f.partnerStatus !== "NONE" && f.partnerStatus !== "APPROVED" && (
                    <form action={reviewPartnerAction.bind(null, f.id, "APPROVED")}>
                      <button type="submit" className={buttonClass.small}>
                        Approve partner
                      </button>
                    </form>
                  )}
                  {f.partnerStatus === "PENDING" && (
                    <form action={reviewPartnerAction.bind(null, f.id, "REJECTED")}>
                      <button type="submit" className={buttonClass.small}>
                        Reject
                      </button>
                    </form>
                  )}
                  {f.partnerStatus === "APPROVED" && (
                    <form action={reviewPartnerAction.bind(null, f.id, "SUSPENDED")}>
                      <button type="submit" className={buttonClass.small}>
                        Suspend partner
                      </button>
                    </form>
                  )}
                  <form action={toggleFacilityActiveAction.bind(null, f.id)}>
                    <button type="submit" className={buttonClass.small}>
                      {f.isActive ? "Hide" : "Show"} in directory
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
