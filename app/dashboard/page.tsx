import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Badge, BloodGroupBadge, buttonClass, Card, cn, EmptyState, PageContainer, PageHeader, Stat } from "@/components/ui";
import { setAvailabilityAction, switchModeAction } from "@/lib/actions/profile";
import { requireUser } from "@/lib/auth";
import { compatibleDonorGroups, recipientGroupsFor } from "@/lib/blood";
import { bloodGroupLabel, labelOf, REQUEST_STATUSES, REQUEST_STATUS_TONE, type BloodGroupValue } from "@/lib/constants";
import { db } from "@/lib/db";
import { requestTime } from "@/lib/request-time";
import { isInCooldown } from "@/lib/donation-cycle";
import { visibleDonorWhere } from "@/lib/donors";
import { daysUntil, formatDate, formatDateTime } from "@/lib/format";
import { distanceBetween, formatDistance, userOrigin } from "@/lib/geo";
import { getRewardStatus } from "@/lib/rewards";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const now = await requestTime();
  const mode = user.activeMode === "DONOR" && user.isDonor ? "DONOR" : "RECEIVER";
  const cooldown = isInCooldown(user, now);
  const bloodGroup = user.bloodGroup as BloodGroupValue | null;
  const origin = userOrigin(user);

  const [myRequests, nearbyDonors, verifiedDonations, unread] = await Promise.all([
    db.bloodRequest.findMany({
      where: { requesterId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { _count: { select: { responses: { where: { status: "ACCEPTED" } } } } },
    }),
    bloodGroup
      ? db.user.count({
          where: {
            ...visibleDonorWhere(now),
            bloodGroup: { in: compatibleDonorGroups(bloodGroup) },
            id: { not: user.id },
            ...(user.district ? { district: user.district } : {}),
          },
        })
      : Promise.resolve(0),
    db.donation.count({ where: { donorId: user.id, status: "VERIFIED" } }),
    db.notification.findMany({ where: { userId: user.id, readAt: null }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  const matchingRequests =
    mode === "DONOR" && bloodGroup
      ? await db.bloodRequest.findMany({
          where: {
            status: { in: ["OPEN", "ACCEPTED"] },
            bloodGroup: { in: recipientGroupsFor(bloodGroup) },
            requesterId: { not: user.id },
            ...(user.district && !origin ? { district: user.district } : {}),
          },
          orderBy: [{ isEmergency: "desc" }, { neededBy: "asc" }],
          take: 50,
          include: { responses: { where: { donorId: user.id }, select: { status: true } } },
        })
      : [];

  const requestsForDonor = matchingRequests
    .map((r) => ({ ...r, distanceKm: distanceBetween(origin, r.latitude, r.longitude) }))
    .filter((r) => r.distanceKm == null || r.distanceKm <= 30)
    .slice(0, 8);

  const rewards = getRewardStatus(verifiedDonations);

  return (
    <PageContainer>
      <PageHeader
        title={`Hello, ${user.name?.split(" ")[0] ?? "there"}`}
        description={`Blood group ${bloodGroupLabel(user.bloodGroup)} · ${user.district ?? "Location not set"}`}
        actions={
          <>
            <Link href="/requests/new" className={buttonClass.secondary}>
              New request
            </Link>
            <Link href="/emergency" className={buttonClass.primary}>
              Emergency
            </Link>
          </>
        }
      />

      <div className="mb-6 grid w-full grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 sm:inline-grid sm:w-auto">
        {(["RECEIVER", "DONOR"] as const).map((value) => (
          <form key={value} action={switchModeAction.bind(null, value)}>
            <button
              type="submit"
              className={cn(
                "w-full rounded-lg px-3 py-2 text-sm font-semibold sm:px-6",
                mode === value ? "bg-white text-red-600 shadow" : "text-gray-600 hover:text-gray-900",
              )}
            >
              {value === "RECEIVER" ? "Receiver mode" : user.isDonor ? "Donor mode" : "Become a donor"}
            </button>
          </form>
        ))}
      </div>

      {mode === "DONOR" ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Availability" className="lg:col-span-1">
            {cooldown ? (
              <div className="space-y-2">
                <Badge tone="yellow">Resting after donation</Badge>
                <p className="text-sm text-gray-700">
                  Thank you for donating! You are hidden from the map until <strong>{formatDate(user.hiddenUntil)}</strong> (
                  {daysUntil(user.hiddenUntil!, now)} days left). You will be notified when you can donate again.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={cn("h-3 w-3 rounded-full", user.isAvailable ? "bg-green-500" : "bg-gray-400")} />
                  <span className="font-semibold">{user.isAvailable ? "Available to donate" : "Not available"}</span>
                </div>
                <p className="text-sm text-gray-600">
                  {user.isAvailable
                    ? "You appear on the map and receive alerts for matching requests."
                    : "Turn this on to appear on the map and get request alerts."}
                </p>
                <form action={setAvailabilityAction.bind(null, !user.isAvailable)}>
                  <button type="submit" className={user.isAvailable ? buttonClass.secondary : buttonClass.success}>
                    {user.isAvailable ? "Set as not available" : "I'm available"}
                  </button>
                </form>
                {user.isAvailable && user.latitude == null && (
                  <Alert tone="warning">
                    Add your location in your <Link href="/profile" className="underline">profile</Link> or turn on &quot;Live&quot; in the header to appear on the map.
                  </Alert>
                )}
              </div>
            )}
            <div className="mt-4 border-t border-gray-100 pt-4 text-sm text-gray-600">
              Last donation: <strong>{formatDate(user.lastDonationAt)}</strong>
              <Link href="/donations/new" className="mt-2 block font-medium text-red-600 hover:underline">
                Submit donation proof →
              </Link>
            </div>
          </Card>

          <Card title="Requests you can help with" className="lg:col-span-2" actions={<Link href="/requests" className="text-sm text-red-600 hover:underline">All requests</Link>}>
            {requestsForDonor.length === 0 ? (
              <p className="text-sm text-gray-600">No matching requests near you right now. We&apos;ll notify you when someone needs your blood group.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {requestsForDonor.map((r) => (
                  <li key={r.id}>
                    <Link href={`/requests/${r.id}`} className="flex items-center gap-3 py-3 hover:bg-gray-50">
                      <BloodGroupBadge group={r.bloodGroup} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {r.units} unit(s) at {r.hospitalName}
                        </p>
                        <p className="text-xs text-gray-500">
                          Needed by {formatDateTime(r.neededBy)}
                          {r.distanceKm != null ? ` · ${formatDistance(r.distanceKm)}` : r.district ? ` · ${r.district}` : ""}
                        </p>
                      </div>
                      {(r.isEmergency || r.responses[0]) && (
                        <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center">
                          {r.isEmergency && <Badge tone="red">Emergency</Badge>}
                          {r.responses[0] && (
                            <Badge tone={r.responses[0].status === "ACCEPTED" ? "green" : "gray"}>{r.responses[0].status.toLowerCase()}</Badge>
                          )}
                        </div>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Your rewards" className="lg:col-span-3" actions={<Link href="/donations" className="text-sm text-red-600 hover:underline">History & certificates</Link>}>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
              <div>
                <p className="text-sm text-gray-500">Level</p>
                <p className="text-xl font-bold">{rewards.level.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Verified donations</p>
                <p className="text-xl font-bold">{verifiedDonations}</p>
              </div>
              {rewards.nextLevel && (
                <div className="min-w-0 basis-full sm:min-w-60 sm:flex-1 sm:basis-0">
                  <p className="text-sm text-gray-500">
                    {rewards.nextLevel.min - verifiedDonations} more to reach {rewards.nextLevel.name}
                  </p>
                  <div className="mt-1 h-2 rounded-full bg-gray-100">
                    <div className="h-2 rounded-full bg-red-600" style={{ width: `${rewards.progress}%` }} />
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:col-span-3 lg:grid-cols-4">
            <Stat label="Compatible donors nearby" value={nearbyDonors} hint={user.district ?? "All areas"} href={`/map?bloodGroup=${user.bloodGroup ?? ""}&compatible=1`} />
            <Stat label="Your requests" value={myRequests.length} href="/requests?mine=1" />
            <Stat label="Unread notifications" value={unread.length} href="/notifications" />
            <Stat label="Need medicine?" value="Order" href="/pharmacy" />
          </div>

          <Card title="Your blood requests" className="lg:col-span-2" actions={<Link href="/requests/new" className="text-sm text-red-600 hover:underline">New request</Link>}>
            {myRequests.length === 0 ? (
              <EmptyState
                title="No requests yet"
                description="Post a request and we will alert compatible donors nearby."
                action={<Link href="/requests/new" className={buttonClass.primary}>Request blood</Link>}
              />
            ) : (
              <ul className="divide-y divide-gray-100">
                {myRequests.map((r) => (
                  <li key={r.id}>
                    <Link href={`/requests/${r.id}`} className="flex items-center gap-3 py-3 hover:bg-gray-50">
                      <BloodGroupBadge group={r.bloodGroup} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{r.hospitalName}</p>
                        <p className="text-xs text-gray-500">
                          {r.units} unit(s) · {r._count.responses} donor(s) accepted · {r.alertedCount} alerted
                        </p>
                      </div>
                      <Badge tone={REQUEST_STATUS_TONE[r.status]}>{labelOf(REQUEST_STATUSES, r.status)}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Latest notifications" actions={<Link href="/notifications" className="text-sm text-red-600 hover:underline">View all</Link>}>
            {unread.length === 0 ? (
              <p className="text-sm text-gray-600">You&apos;re all caught up.</p>
            ) : (
              <ul className="space-y-3">
                {unread.map((n) => (
                  <li key={n.id} className="text-sm">
                    <p className="font-medium">{n.title}</p>
                    <p className="text-gray-600">{n.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
