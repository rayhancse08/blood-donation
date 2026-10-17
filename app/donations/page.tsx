import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Badge, buttonClass, Card, EmptyState, PageContainer, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { DONATION_STATUS_TONE } from "@/lib/constants";
import { db } from "@/lib/db";
import { requestTime } from "@/lib/request-time";
import { DONATION_COOLDOWN_DAYS, isInCooldown } from "@/lib/donation-cycle";
import { daysUntil, formatDate, one } from "@/lib/format";
import { getRewardStatus, LEVELS } from "@/lib/rewards";

export const metadata: Metadata = { title: "Donations & rewards" };

export default async function DonationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const now = await requestTime();

  const donations = await db.donation.findMany({
    where: { donorId: user.id },
    orderBy: { donatedAt: "desc" },
    include: { request: { select: { id: true, hospitalName: true, patientName: true } } },
  });
  const verifiedCount = donations.filter((d) => d.status === "VERIFIED").length;
  const rewards = getRewardStatus(verifiedCount);

  const offers = await db.partnerOffer.findMany({
    where: {
      isActive: true,
      facility: { partnerStatus: "APPROVED", isActive: true },
      OR: [{ validUntil: null }, { validUntil: { gte: now } }],
    },
    include: { facility: { select: { id: true, name: true, district: true } } },
    orderBy: { minDonations: "asc" },
    take: 30,
  });

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Donations & rewards"
        description="Your donation history, badges, certificates and partner offers."
        actions={
          user.isDonor && (
            <Link href="/donations/new" className={buttonClass.primary}>
              Submit donation proof
            </Link>
          )
        }
      />

      {one(params.submitted) === "1" && (
        <Alert tone="success">Thank you! Your donation proof was submitted and will be verified shortly.</Alert>
      )}
      {!user.isDonor && (
        <Alert tone="info">
          You are not a donor yet. <Link href="/profile#roles" className="underline">Enable the donor role</Link> to start
          recording donations and earning rewards.
        </Alert>
      )}
      {isInCooldown(user, now) && (
        <Alert tone="warning">
          You are resting after your last donation and hidden from the map for {daysUntil(user.hiddenUntil!, now)} more day(s) (until{" "}
          {formatDate(user.hiddenUntil)}). Donors should wait {DONATION_COOLDOWN_DAYS} days between whole-blood donations.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Your level" className="lg:col-span-1">
          <p className="text-3xl font-extrabold text-red-600">{rewards.level.name}</p>
          <p className="mt-1 text-sm text-gray-600">{rewards.level.perk}</p>
          <p className="mt-4 text-sm">
            <strong>{verifiedCount}</strong> verified donation(s)
          </p>
          {rewards.nextLevel ? (
            <div className="mt-2">
              <div className="h-2 rounded-full bg-gray-100">
                <div className="h-2 rounded-full bg-red-600" style={{ width: `${rewards.progress}%` }} />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {rewards.nextLevel.min - verifiedCount} more to reach {rewards.nextLevel.name}: {rewards.nextLevel.perk}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm font-medium text-green-700">You have reached the highest level. Thank you, hero!</p>
          )}
          <Link href="/leaderboard" className="mt-4 block text-sm font-medium text-red-600 hover:underline">
            View top donors →
          </Link>
        </Card>

        <Card title="Badges" className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[...rewards.earnedBadges, ...rewards.lockedBadges].map((badge) => {
              const earned = verifiedCount >= badge.min;
              return (
                <div key={badge.id} className={`rounded-xl border p-3 ${earned ? "border-red-200 bg-red-50" : "border-gray-200 bg-gray-50 opacity-60"}`}>
                  <p className="font-semibold">{badge.title}</p>
                  <p className="text-xs text-gray-600">{badge.description}</p>
                  {!earned && <p className="mt-1 text-xs text-gray-500">Locked</p>}
                </div>
              );
            })}
          </div>
          <div className="mt-4 border-t border-gray-100 pt-4">
            <p className="mb-2 text-sm font-semibold">Level path</p>
            <ol className="flex flex-wrap gap-2 text-xs">
              {LEVELS.map((level) => (
                <li key={level.name} className={`rounded-full px-3 py-1 ${verifiedCount >= level.min ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600"}`}>
                  {level.name} ({level.min}+)
                </li>
              ))}
            </ol>
          </div>
        </Card>
      </div>

      <Card title="Partner offers for donors">
        {offers.length === 0 ? (
          <p className="text-sm text-gray-600">No partner offers right now. Check back soon!</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {offers.map((offer) => {
              const unlocked = verifiedCount >= offer.minDonations;
              return (
                <div key={offer.id} className={`rounded-xl border p-4 ${unlocked ? "border-green-200 bg-green-50" : "border-gray-200"}`}>
                  <p className="font-semibold">{offer.title}</p>
                  <p className="text-sm text-gray-600">{offer.description}</p>
                  <Link href={`/directory/${offer.facility.id}`} className="mt-1 block text-xs text-red-600 hover:underline">
                    {offer.facility.name}
                    {offer.facility.district ? `, ${offer.facility.district}` : ""}
                  </Link>
                  {unlocked ? (
                    offer.code && (
                      <p className="mt-2 text-sm">
                        Code: <span className="rounded bg-white px-2 py-0.5 font-mono font-bold">{offer.code}</span>
                      </p>
                    )
                  ) : (
                    <p className="mt-2 text-xs text-gray-500">Unlocks after {offer.minDonations} verified donation(s)</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card title="Donation history">
        {donations.length === 0 ? (
          <EmptyState title="No donations recorded yet" description="After donating, submit proof from the hospital or blood bank to add it here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-gray-500">
                <tr>
                  <th className="whitespace-nowrap py-2 pr-3">Date</th>
                  <th>Place</th>
                  <th>Receiver / request</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {donations.map((d) => (
                  <tr key={d.id}>
                    <td className="whitespace-nowrap py-3 pr-3">{formatDate(d.donatedAt)}</td>
                    <td>{d.place}</td>
                    <td>
                      {d.request ? (
                        <Link href={`/requests/${d.request.id}`} className="text-red-600 hover:underline">
                          {d.request.patientName ?? d.request.hospitalName}
                        </Link>
                      ) : (
                        (d.receiverName ?? "—")
                      )}
                    </td>
                    <td>
                      <Badge tone={DONATION_STATUS_TONE[d.status]}>{d.status.toLowerCase()}</Badge>
                      {d.status === "REJECTED" && d.reviewNote && <p className="text-xs text-gray-500">{d.reviewNote}</p>}
                    </td>
                    <td className="text-right">
                      {d.status === "VERIFIED" && (
                        <Link href={`/donations/${d.id}/certificate`} className={buttonClass.small}>
                          Certificate
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
