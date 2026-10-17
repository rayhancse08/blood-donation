import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { GeoInputs } from "@/components/GeoInputs";
import { LocationFields } from "@/components/LocationFields";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, buttonClass, Card, Field, inputClass, PageContainer, PageHeader, SelectOptions } from "@/components/ui";
import { registerPartnerAction } from "@/lib/actions/partner";
import { requireUser } from "@/lib/auth";
import { FACILITY_TYPES, facilityTypeLabel, labelOf, PARTNER_STATUSES, PARTNER_STATUS_TONE } from "@/lib/constants";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Partner portal" };

export default async function PartnerPage() {
  const user = await requireUser();
  const facilities = await db.facility.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { orders: { where: { status: "PENDING" } } } } },
  });

  return (
    <PageContainer className="max-w-4xl space-y-6">
      <PageHeader
        title="Partner portal"
        description="Hospitals, clinics, diagnostic centers, pharmacies, ambulance services and blood banks can join as partners, accept in-app payments and offer discounts to users."
      />

      {facilities.length > 0 && (
        <Card title="Your facilities">
          <ul className="divide-y divide-gray-100">
            {facilities.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/partner/${f.id}`} className="font-semibold hover:underline">
                    {f.name}
                  </Link>
                  <p className="text-xs text-gray-500">
                    {facilityTypeLabel(f.type)} · {f.district}
                  </p>
                </div>
                {f._count.orders > 0 && <Badge tone="red">{f._count.orders} new order(s)</Badge>}
                <Badge tone={PARTNER_STATUS_TONE[f.partnerStatus]}>{labelOf(PARTNER_STATUSES, f.partnerStatus)}</Badge>
                <Link href={`/partner/${f.id}`} className={buttonClass.small}>
                  Manage
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Apply to become a partner">
        <ActionForm action={registerPartnerAction} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Provider type" required>
              <select name="type" required defaultValue="" className={inputClass}>
                <SelectOptions options={FACILITY_TYPES} placeholder="Select type" />
              </select>
            </Field>
            <Field label="Name" required>
              <input name="name" required maxLength={150} className={inputClass} />
            </Field>
            <Field label="Phone" required>
              <input name="phone" type="tel" required className={inputClass} />
            </Field>
            <Field label="Email">
              <input name="email" type="email" className={inputClass} />
            </Field>
            <Field label="Website">
              <input name="website" type="url" className={inputClass} />
            </Field>
            <Field label="Opening hours">
              <input name="openingHours" placeholder="e.g. Sat-Thu 9am-10pm" className={inputClass} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is24Hours" /> Open 24 hours
          </label>
          <Field label="Description">
            <textarea name="description" rows={3} maxLength={1000} className={inputClass} />
          </Field>
          <Field label="Services" hint="Comma separated, e.g. ICU, Blood test, X-ray, Home delivery">
            <input name="services" maxLength={500} className={inputClass} />
          </Field>

          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold">Location</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <LocationFields required />
            </div>
            <Field label="Address" required>
              <input name="address" required maxLength={300} className={inputClass} />
            </Field>
            <GeoInputs label="Use my current location (if you are at the facility)" />
          </fieldset>

          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-semibold sm:col-span-2">Licence & verification</legend>
            <Field label="Trade / drug licence number" required>
              <input name="licenseNumber" required maxLength={60} className={inputClass} />
            </Field>
            <Field label="Licence document" required hint="JPG, PNG or PDF, max 5 MB">
              <input name="licenseDoc" type="file" required accept="image/jpeg,image/png,image/webp,application/pdf" className="text-sm" />
            </Field>
          </fieldset>

          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-semibold sm:col-span-2">Discount for app users</legend>
            <Field label="Discount (%)" required>
              <input name="discountPercent" type="number" min={0} max={50} defaultValue={5} required className={inputClass} />
            </Field>
            <Field label="Discount terms" className="sm:col-span-2">
              <textarea name="discountTerms" rows={2} maxLength={1000} placeholder="e.g. Applies to all diagnostic tests except imported reagents." className={inputClass} />
            </Field>
          </fieldset>

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="agree" required className="mt-1" />
            I confirm the information is correct and agree to provide the discount above to Blood App users paying through the app.
          </label>

          <SubmitButton pendingText="Submitting…">Submit application</SubmitButton>
        </ActionForm>
      </Card>
    </PageContainer>
  );
}
