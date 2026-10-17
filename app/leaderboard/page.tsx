import type { Metadata } from "next";
import { connection } from "next/server";
import { Avatar, Badge, Card, EmptyState, PageContainer, PageHeader } from "@/components/ui";
import { bloodGroupLabel } from "@/lib/constants";
import { db } from "@/lib/db";
import { getRewardStatus } from "@/lib/rewards";

export const metadata: Metadata = { title: "Top donors" };

export default async function LeaderboardPage() {
  await connection();

  const top = await db.donation.groupBy({
    by: ["donorId"],
    where: { status: "VERIFIED" },
    _count: { donorId: true },
    orderBy: { _count: { donorId: "desc" } },
    take: 25,
  });

  const donors = await db.user.findMany({
    where: { id: { in: top.map((t) => t.donorId) }, isSuspended: false },
    select: { id: true, name: true, photoUrl: true, bloodGroup: true, district: true },
  });
  const byId = new Map(donors.map((d) => [d.id, d]));

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader title="Top donors" description="Celebrating the heroes with the most verified donations." />
      {top.length === 0 ? (
        <EmptyState title="No verified donations yet" description="Be the first on the leaderboard!" />
      ) : (
        <Card>
          <ol className="divide-y divide-gray-100">
            {top.map((entry, index) => {
              const donor = byId.get(entry.donorId);
              if (!donor) return null;
              const count = entry._count.donorId;
              return (
                <li key={entry.donorId} className="flex items-center gap-4 py-3">
                  <span className={`w-8 text-center text-lg font-bold ${index < 3 ? "text-red-600" : "text-gray-400"}`}>{index + 1}</span>
                  <Avatar name={donor.name} src={donor.photoUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{donor.name ?? "Donor"}</p>
                    <p className="text-xs text-gray-500">
                      {bloodGroupLabel(donor.bloodGroup)} · {donor.district ?? "Bangladesh"}
                    </p>
                  </div>
                  <Badge tone="purple">{getRewardStatus(count).level.name}</Badge>
                  <span className="w-20 text-right font-bold">{count}</span>
                </li>
              );
            })}
          </ol>
        </Card>
      )}
    </PageContainer>
  );
}
