import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert, buttonClass, Card, Field, inputClass, PageContainer, PageHeader } from "@/components/ui";
import { submitDonationAction } from "@/lib/actions/donations";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { requestTime } from "@/lib/request-time";
import { one, toDateInputValue } from "@/lib/format";

export const metadata: Metadata = { title: "Submit donation proof" };

export default async function NewDonationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const now = await requestTime();

  if (!user.isDonor) {
    return (
      <PageContainer className="max-w-2xl">
        <Alert tone="info">
          Only donors can submit donations. <Link href="/profile#roles" className="underline">Enable the donor role</Link> first.
        </Alert>
      </PageContainer>
    );
  }

  const [acceptedRequests, facilities] = await Promise.all([
    db.requestResponse.findMany({
      where: { donorId: user.id, status: "ACCEPTED" },
      include: { request: { select: { id: true, hospitalName: true, patientName: true, createdAt: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.facility.findMany({
      where: { type: { in: ["HOSPITAL", "CLINIC", "BLOOD_BANK", "DONATION_CENTER"] }, isActive: true, ...(user.district ? { district: user.district } : {}) },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
  ]);

  const preselected = one(params.requestId);

  return (
    <PageContainer className="max-w-2xl">
      <PageHeader
        title="Submit donation proof"
        description="Upload a document from the hospital or blood bank. Once verified, the donation is added to your history and you are hidden from the map for 3 months so you can recover."
      />
      <Card>
        <ActionForm action={submitDonationAction}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Donation date" required>
              <input name="donatedAt" type="date" max={toDateInputValue(now)} defaultValue={toDateInputValue(now)} required className={inputClass} />
            </Field>
            <Field label="Units donated">
              <select name="units" defaultValue="1" className={inputClass}>
                <option value="1">1 unit</option>
                <option value="2">2 units</option>
              </select>
            </Field>
          </div>

          <Field label="Linked blood request" hint="Requests you accepted in the app">
            <select name="requestId" defaultValue={preselected} className={inputClass}>
              <option value="">Not through an app request</option>
              {acceptedRequests.map(({ request }) => (
                <option key={request.id} value={request.id}>
                  {request.hospitalName}
                  {request.patientName ? ` - ${request.patientName}` : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Hospital / blood bank from directory">
            <select name="facilityId" defaultValue="" className={inputClass}>
              <option value="">Not listed</option>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Donation place" hint="Required if the hospital is not listed above">
            <input name="place" maxLength={200} className={inputClass} />
          </Field>

          <Field label="Receiver name" hint="Optional">
            <input name="receiverName" maxLength={100} className={inputClass} />
          </Field>

          <Field label="Proof document" required hint="Donor card, blood bank slip or hospital certificate. JPG, PNG or PDF, max 5 MB.">
            <input name="document" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required className="text-sm" />
          </Field>

          <SubmitButton className={`${buttonClass.primary} w-full`} pendingText="Uploading…">
            Submit for verification
          </SubmitButton>
        </ActionForm>
      </Card>
    </PageContainer>
  );
}
