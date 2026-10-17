import type { Metadata } from "next";
import { ActionForm } from "@/components/ActionForm";
import { GeoInputs } from "@/components/GeoInputs";
import { LocationFields } from "@/components/LocationFields";
import { SubmitButton } from "@/components/SubmitButton";
import { BloodGroupSelect, buttonClass, Card, Field, inputClass, PageContainer, PageHeader, SelectOptions } from "@/components/ui";
import { createRequestAction } from "@/lib/actions/requests";
import { requireUser } from "@/lib/auth";
import { isBloodGroup } from "@/lib/blood";
import { URGENCIES } from "@/lib/constants";
import { db } from "@/lib/db";
import { requestTime } from "@/lib/request-time";
import { addDays, one, toDateTimeInputValue } from "@/lib/format";

export const metadata: Metadata = { title: "Request blood" };

export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const requestedGroup = one(params.bloodGroup);
  const now = await requestTime();

  const hospitals = await db.facility.findMany({
    where: { type: { in: ["HOSPITAL", "CLINIC", "BLOOD_BANK"] }, isActive: true, ...(user.district ? { district: user.district } : {}) },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 200,
  });

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        title="Request blood"
        description="We will alert available donors with a compatible blood group near the hospital."
      />
      <Card>
        <ActionForm action={createRequestAction} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Blood group needed" required>
              <BloodGroupSelect defaultValue={isBloodGroup(requestedGroup) ? requestedGroup : user.bloodGroup} required />
            </Field>
            <Field label="Units (bags) needed" required>
              <input name="units" type="number" min={1} max={10} defaultValue={1} required className={inputClass} />
            </Field>
            <Field label="Patient name" hint="Optional">
              <input name="patientName" maxLength={100} className={inputClass} />
            </Field>
            <Field label="Urgency" required>
              <select name="urgency" defaultValue="NORMAL" className={inputClass}>
                <SelectOptions options={URGENCIES} />
              </select>
            </Field>
            <Field label="Hospital" required className="sm:col-span-2">
              <input name="hospitalName" list="hospital-options" required maxLength={150} placeholder="Hospital or blood bank name" className={inputClass} />
              <datalist id="hospital-options">
                {hospitals.map((h) => (
                  <option key={h.id} value={h.name} />
                ))}
              </datalist>
            </Field>
            <Field label="Needed by" required>
              <input name="neededBy" type="datetime-local" defaultValue={toDateTimeInputValue(addDays(now, 1))} required className={inputClass} />
            </Field>
            <Field label="Contact phone" required hint="Shown to donors only after they accept">
              <input name="contactPhone" type="tel" defaultValue={user.contactPhone ?? user.phone ?? ""} required className={inputClass} />
            </Field>
          </div>

          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold">Hospital location</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <LocationFields
                required
                defaults={{ division: user.division, district: user.district, upazila: user.upazila, thana: user.thana }}
              />
            </div>
            <Field label="Ward / address details">
              <input name="address" maxLength={300} placeholder="e.g. Ward 5, Bed 12" className={inputClass} />
            </Field>
            <Field label="Map location" hint="Use your current location if you are at the hospital, so nearby donors are alerted first.">
              <GeoInputs label="Use current location" />
            </Field>
          </fieldset>

          <Field label="Notes for donors">
            <textarea name="notes" rows={3} maxLength={1000} className={inputClass} placeholder="e.g. Patient is undergoing surgery, please come to the blood bank on the 2nd floor." />
          </Field>

          <SubmitButton className={`${buttonClass.primary} w-full`} pendingText="Posting request…">
            Post request & alert donors
          </SubmitButton>
        </ActionForm>
      </Card>
    </PageContainer>
  );
}
