import type { Metadata } from "next";
import Link from "next/link";
import { Badge, buttonClass, Card, EmptyState, inputClass, PageHeader, Tabs } from "@/components/ui";
import { resolveReportAction } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { bloodGroupLabel } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDateTime, one } from "@/lib/format";

export const metadata: Metadata = { title: "Reports & moderation" };

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const showClosed = one((await searchParams).tab) === "closed";

  const reports = await db.report.findMany({
    where: showClosed ? { status: { in: ["RESOLVED", "DISMISSED"] } } : { status: "OPEN" },
    orderBy: { createdAt: showClosed ? "desc" : "asc" },
    take: 100,
    include: {
      reporter: { select: { id: true, name: true, phone: true } },
      reportedUser: {
        select: {
          id: true,
          name: true,
          phone: true,
          isSuspended: true,
          bloodGroup: true,
          _count: { select: { reportsReceived: true } },
        },
      },
      request: { select: { id: true, hospitalName: true, bloodGroup: true, status: true } },
    },
  });

  return (
    <div>
      <PageHeader title="Reports & moderation" description="Review reports about fake profiles, abuse, and requests asking for money." />
      <Tabs
        active={showClosed ? "closed" : "open"}
        items={[
          { key: "open", label: "Open", href: "/admin/reports" },
          { key: "closed", label: "Closed", href: "/admin/reports?tab=closed" },
        ]}
      />
      {reports.length === 0 ? (
        <EmptyState title={showClosed ? "No closed reports" : "No open reports"} />
      ) : (
        <div className="space-y-4">
          {reports.map((r) => (
            <Card
              key={r.id}
              title={r.reason}
              actions={
                <span className="text-xs text-gray-500">
                  {formatDateTime(r.createdAt)} {r.status !== "OPEN" && <Badge tone={r.status === "RESOLVED" ? "green" : "gray"}>{r.status.toLowerCase()}</Badge>}
                </span>
              }
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1 text-sm">
                  <p>
                    <strong>Reported by:</strong> {r.reporter.name ?? "User"} ({r.reporter.phone ?? "no phone"})
                  </p>
                  {r.reportedUser && (
                    <p>
                      <strong>Reported user:</strong> {r.reportedUser.name ?? "User"} · {bloodGroupLabel(r.reportedUser.bloodGroup)} ·{" "}
                      {r.reportedUser.phone ?? "no phone"} <Badge tone="orange">{r.reportedUser._count.reportsReceived} report(s)</Badge>{" "}
                      {r.reportedUser.isSuspended && <Badge tone="red">Suspended</Badge>}
                    </p>
                  )}
                  {r.request && (
                    <p>
                      <strong>Request:</strong>{" "}
                      <Link href={`/requests/${r.request.id}`} className="text-red-600 hover:underline">
                        {bloodGroupLabel(r.request.bloodGroup)} at {r.request.hospitalName}
                      </Link>{" "}
                      ({r.request.status.toLowerCase()})
                    </p>
                  )}
                  {r.details && <p className="whitespace-pre-line rounded-lg bg-gray-50 p-3">{r.details}</p>}
                  {r.adminNote && (
                    <p>
                      <strong>Admin note:</strong> {r.adminNote}
                    </p>
                  )}
                </div>
                {r.status === "OPEN" && (
                  <form className="space-y-2">
                    <textarea name="note" rows={2} maxLength={500} placeholder="Internal note" className={inputClass} />
                    {r.reportedUser && !r.reportedUser.isSuspended && (
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="suspend" /> Suspend the reported user
                      </label>
                    )}
                    {r.request && (r.request.status === "OPEN" || r.request.status === "ACCEPTED") && (
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="cancelRequest" /> Close the reported request
                      </label>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button formAction={resolveReportAction.bind(null, r.id, "RESOLVED")} className={buttonClass.dark}>
                        Resolve
                      </button>
                      <button formAction={resolveReportAction.bind(null, r.id, "DISMISSED")} className={buttonClass.secondary}>
                        Dismiss
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
