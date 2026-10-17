import type { Metadata } from "next";
import { Card, PageHeader, Stat } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { BLOOD_GROUPS, bloodGroupLabel, labelOf, REQUEST_STATUSES } from "@/lib/constants";
import { db } from "@/lib/db";
import { requestTime } from "@/lib/request-time";
import { visibleDonorWhere } from "@/lib/donors";
import { addDays } from "@/lib/format";
import { formatTaka } from "@/lib/money";

export const metadata: Metadata = { title: "Admin overview" };

function Bars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.label} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0 truncate text-gray-600">{row.label}</span>
          <span className="h-3 flex-1 rounded-full bg-gray-100">
            <span className="block h-3 rounded-full bg-red-500" style={{ width: `${(row.value / max) * 100}%` }} />
          </span>
          <span className="w-12 text-right font-medium">{row.value}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function AdminOverviewPage() {
  await requireAdmin();
  const now = await requestTime();
  const since30 = addDays(now, -30);

  const [
    users,
    donors,
    availableDonors,
    newUsers30,
    requestsByStatus,
    emergencies30,
    pendingDonations,
    pendingIds,
    pendingPartners,
    openReports,
    paid,
    donorsByGroup,
    requestsByDistrict,
    verifiedDonations30,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { isDonor: true } }),
    db.user.count({ where: visibleDonorWhere(now) }),
    db.user.count({ where: { createdAt: { gte: since30 } } }),
    db.bloodRequest.groupBy({ by: ["status"], _count: { _all: true } }),
    db.bloodRequest.count({ where: { isEmergency: true, createdAt: { gte: since30 } } }),
    db.donation.count({ where: { status: "PENDING" } }),
    db.user.count({ where: { idVerificationStatus: "PENDING" } }),
    db.facility.count({ where: { partnerStatus: "PENDING" } }),
    db.report.count({ where: { status: "OPEN" } }),
    db.payment.aggregate({ where: { status: "PAID" }, _sum: { total: true, discount: true }, _count: true }),
    db.user.groupBy({ by: ["bloodGroup"], where: { isDonor: true }, _count: { _all: true } }),
    db.bloodRequest.groupBy({
      by: ["district"],
      where: { createdAt: { gte: since30 } },
      _count: { _all: true },
      orderBy: { _count: { district: "desc" } },
      take: 8,
    }),
    db.donation.count({ where: { status: "VERIFIED", reviewedAt: { gte: since30 } } }),
  ]);

  const statusCount = (status: string) => requestsByStatus.find((r) => r.status === status)?._count._all ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Admin overview" description="Platform health and items that need your attention." />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Users" value={users} hint={`${newUsers30} new in 30 days`} href="/admin/users" />
        <Stat label="Donors" value={donors} hint={`${availableDonors} available now`} href="/admin/users?donor=1" />
        <Stat label="Active requests" value={statusCount("OPEN") + statusCount("ACCEPTED")} hint={`${emergencies30} emergencies in 30 days`} href="/admin/requests" />
        <Stat label="Verified donations (30d)" value={verifiedDonations30} />
        <Stat label="Pending donation proofs" value={pendingDonations} href="/admin/verifications" />
        <Stat label="Pending ID verifications" value={pendingIds} href="/admin/verifications?tab=identity" />
        <Stat label="Partner applications" value={pendingPartners} href="/admin/facilities?tab=pending" />
        <Stat label="Open reports" value={openReports} href="/admin/reports" />
        <Stat label="Payments processed" value={paid._count} href="/admin/payments" />
        <Stat label="Payment volume" value={formatTaka(paid._sum.total ?? 0)} />
        <Stat label="Discounts given" value={formatTaka(paid._sum.discount ?? 0)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Requests by status">
          <Bars rows={REQUEST_STATUSES.map((s) => ({ label: labelOf(REQUEST_STATUSES, s.value), value: statusCount(s.value) }))} />
        </Card>
        <Card title="Donors by blood group">
          <Bars
            rows={BLOOD_GROUPS.map((g) => ({
              label: bloodGroupLabel(g.value),
              value: donorsByGroup.find((d) => d.bloodGroup === g.value)?._count._all ?? 0,
            }))}
          />
        </Card>
        <Card title="Requests by district (30 days)">
          {requestsByDistrict.length === 0 ? (
            <p className="text-sm text-gray-600">No requests in the last 30 days.</p>
          ) : (
            <Bars rows={requestsByDistrict.map((r) => ({ label: r.district ?? "GPS only", value: r._count._all }))} />
          )}
        </Card>
      </div>
    </div>
  );
}
