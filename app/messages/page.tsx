import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Avatar, Badge, EmptyState, PageContainer, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { bloodGroupLabel } from "@/lib/constants";
import { db } from "@/lib/db";
import { requestTime } from "@/lib/request-time";
import { one, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const now = await requestTime();

  const conversations = await db.conversation.findMany({
    where: { OR: [{ userAId: user.id }, { userBId: user.id }] },
    orderBy: { lastMessageAt: "desc" },
    include: {
      userA: { select: { id: true, name: true, photoUrl: true, bloodGroup: true } },
      userB: { select: { id: true, name: true, photoUrl: true, bloodGroup: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { messages: { where: { readAt: null, senderId: { not: user.id } } } } },
    },
    take: 100,
  });

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader title="Messages" description="Chat privately with donors and receivers. Your phone number is never shared in chat." />
      {one(params.error) === "unavailable" && <Alert tone="error">That user is not available for messaging.</Alert>}
      {conversations.length === 0 ? (
        <EmptyState title="No conversations yet" description="Start a chat from a donor's profile on the map or from a blood request." />
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {conversations.map((c) => {
            const other = c.userAId === user.id ? c.userB : c.userA;
            const last = c.messages[0];
            return (
              <li key={c.id}>
                <Link href={`/messages/${c.id}`} className="flex items-center gap-3 p-4 hover:bg-gray-50">
                  <Avatar name={other.name} src={other.photoUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {other.name ?? "User"} <span className="text-xs text-gray-500">{bloodGroupLabel(other.bloodGroup)}</span>
                    </p>
                    <p className="truncate text-sm text-gray-600">
                      {last ? `${last.senderId === user.id ? "You: " : ""}${last.body}` : "No messages yet"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs text-gray-400">{timeAgo(c.lastMessageAt, now)}</span>
                    {c._count.messages > 0 && <Badge tone="red">{c._count.messages}</Badge>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageContainer>
  );
}
