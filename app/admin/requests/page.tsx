import type { Metadata } from "next";
import Link from "next/link";
import type { RequestStatus } from "@/generated/prisma/client";
import { Badge, buttonClass, PageHeader, Tabs } from "@/components/ui";
import { adminCancelRequestAction } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth";
import {
  bloodGroupLabel,
  labelOf,
  REQUEST_STATUS_TONE,
  REQUEST_STATUS_VALUES,
  REQUEST_STATUSES,
  URGENCIES,
  URGENCY_TONE,
} from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDateTime, one } from "@/lib/format";

export const metadata: Metadata = { title: "Manage requests" };

export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const statusParam = one(params.status);
  const status = (REQUEST_STATUS_VALUES as string[]).includes(statusParam) ? (statusParam as RequestStatus) : undefined;
  const emergencyOnly = one(params.emergency) === "1";

  const requests = await db.bloodRequest.findMany({
    where: { ...(status ? { status } : {}), ...(emergencyOnly ? { isEmergency: true } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      requester: { select: { name: true, phone: true } },
      _count: { select: { responses: { where: { status: "ACCEPTED" } }, reports: true } },
    },
  });

  const activeTab = emergencyOnly ? "emergency" : (status ?? "all");

  return (
    <div>
      <PageHeader title="Blood requests" description="Monitor all requests and close fake or abusive ones." />
      <Tabs
        active={activeTab}
        items={[
          { key: "all", label: "All", href: "/admin/requests" },
          { key: "emergency", label: "Emergency", href: "/admin/requests?emergency=1" },
          ...REQUEST_STATUSES.map((s) => ({ key: s.value, label: s.label, href: `/admin/requests?status=${s.value}` })),
        ]}
      />
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Request</th>
              <th>Requester</th>
              <th>Needed by</th>
              <th>Status</th>
              <th>Donors</th>
              <th className="px-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {requests.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3">
                  <Link href={`/requests/${r.id}`} className="font-medium hover:underline">
                    {bloodGroupLabel(r.bloodGroup)} · {r.units} unit(s)
                  </Link>
                  <p className="text-xs text-gray-500">
                    {r.hospitalName}
                    {r.district ? `, ${r.district}` : ""}
                  </p>
                  <div className="mt-1 flex gap-1">
                    {r.isEmergency && <Badge tone="red">Emergency</Badge>}
                    <Badge tone={URGENCY_TONE[r.urgency]}>{labelOf(URGENCIES, r.urgency)}</Badge>
                    {r._count.reports > 0 && <Badge tone="orange">{r._count.reports} report(s)</Badge>}
                  </div>
                </td>
                <td>
                  <p>{r.requester.name ?? "—"}</p>
                  <p className="text-xs text-gray-500">{r.contactPhone}</p>
                </td>
                <td className="text-xs">{formatDateTime(r.neededBy)}</td>
                <td>
                  <Badge tone={REQUEST_STATUS_TONE[r.status]}>{labelOf(REQUEST_STATUSES, r.status)}</Badge>
                </td>
                <td className="text-xs text-gray-600">
                  {r.alertedCount} alerted · {r._count.responses} accepted
                </td>
                <td className="px-4">
                  {(r.status === "OPEN" || r.status === "ACCEPTED") && (
                    <form action={adminCancelRequestAction.bind(null, r.id)}>
                      <button type="submit" className={buttonClass.small}>
                        Close request
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {requests.length === 0 && <p className="p-6 text-center text-sm text-gray-500">No requests found.</p>}
      </div>
    </div>
  );
}
