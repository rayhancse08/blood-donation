import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma, RequestStatus } from "@/generated/prisma/client";
import { LocationFields } from "@/components/LocationFields";
import { Badge, BloodGroupBadge, BloodGroupSelect, buttonClass, EmptyState, Field, inputClass, PageContainer, PageHeader } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { isBloodGroup } from "@/lib/blood";
import { labelOf, REQUEST_STATUSES, REQUEST_STATUS_TONE, URGENCIES, URGENCY_TONE } from "@/lib/constants";
import { formatDateTime, one, timeAgo } from "@/lib/format";
import { db } from "@/lib/db";
import { requestTime } from "@/lib/request-time";

export const metadata: Metadata = { title: "Blood requests" };

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const now = await requestTime();

  const bloodGroup = one(params.bloodGroup);
  const division = one(params.division);
  const district = one(params.district);
  const status = one(params.status) || "active";
  const emergencyOnly = one(params.emergency) === "1";
  const mine = one(params.mine) === "1" && !!user;

  const where: Prisma.BloodRequestWhereInput = {
    ...(isBloodGroup(bloodGroup) ? { bloodGroup } : {}),
    ...(division ? { division } : {}),
    ...(district ? { district } : {}),
    ...(emergencyOnly ? { isEmergency: true } : {}),
    ...(mine ? { requesterId: user!.id } : {}),
    ...(status === "active"
      ? { status: { in: ["OPEN", "ACCEPTED"] } }
      : REQUEST_STATUSES.some((s) => s.value === status)
        ? { status: status as RequestStatus }
        : {}),
  };

  const requests = await db.bloodRequest.findMany({
    where,
    orderBy: [{ isEmergency: "desc" }, { createdAt: "desc" }],
    take: 60,
    include: { _count: { select: { responses: { where: { status: "ACCEPTED" } } } } },
  });

  return (
    <PageContainer>
      <PageHeader
        title="Blood requests"
        description="Requests from people who need blood. Donors can accept or decline."
        actions={
          <>
            <Link href="/requests/new" className={buttonClass.primary}>
              Request blood
            </Link>
            <Link href="/emergency" className={buttonClass.danger}>
              Emergency
            </Link>
          </>
        }
      />

      <form className="mb-6 grid gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
        <Field label="Blood group">
          <BloodGroupSelect defaultValue={bloodGroup} placeholder="Any" />
        </Field>
        <LocationFields filterMode showUpazilaThana={false} defaults={{ division, district }} />
        <Field label="Status">
          <select name="status" defaultValue={status} className={inputClass}>
            <option value="active">Active (open & accepted)</option>
            {REQUEST_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex flex-col gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="emergency" value="1" defaultChecked={emergencyOnly} /> Emergencies only
          </label>
          {user && (
            <label className="flex items-center gap-2">
              <input type="checkbox" name="mine" value="1" defaultChecked={mine} /> My requests
            </label>
          )}
        </div>
        <button type="submit" className={buttonClass.dark}>
          Filter
        </button>
      </form>

      {requests.length === 0 ? (
        <EmptyState title="No requests found" description="Try different filters, or post a request yourself." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {requests.map((r) => (
            <Link
              key={r.id}
              href={`/requests/${r.id}`}
              className={`flex gap-4 rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md ${r.isEmergency ? "border-red-300" : "border-gray-200"}`}
            >
              <BloodGroupBadge group={r.bloodGroup} size="lg" />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-1">
                  {r.isEmergency && <Badge tone="red">Emergency</Badge>}
                  <Badge tone={URGENCY_TONE[r.urgency]}>{labelOf(URGENCIES, r.urgency)}</Badge>
                  <Badge tone={REQUEST_STATUS_TONE[r.status]}>{labelOf(REQUEST_STATUSES, r.status)}</Badge>
                </div>
                <p className="truncate font-semibold">{r.hospitalName}</p>
                <p className="text-sm text-gray-600">
                  {r.units} unit(s) · {[r.thana, r.upazila, r.district].filter(Boolean).join(", ") || "Location via GPS"}
                </p>
                <p className="text-xs text-gray-500">
                  Needed by {formatDateTime(r.neededBy)} · posted {timeAgo(r.createdAt, now)} · {r._count.responses} accepted
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
