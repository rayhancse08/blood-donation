import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChatThread } from "@/components/ChatThread";
import { ReportButton } from "@/components/ReportButton";
import { Avatar, Badge, buttonClass, PageContainer } from "@/components/ui";
import { blockUserAction, unblockUserAction } from "@/lib/actions/safety";
import { requireUser } from "@/lib/auth";
import { bloodGroupLabel } from "@/lib/constants";
import { db } from "@/lib/db";
import { requestTime } from "@/lib/request-time";

export const metadata: Metadata = { title: "Conversation" };

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const conversation = await db.conversation.findFirst({
    where: { id, OR: [{ userAId: user.id }, { userBId: user.id }] },
    include: {
      userA: { select: { id: true, name: true, photoUrl: true, bloodGroup: true, idVerificationStatus: true, isSuspended: true } },
      userB: { select: { id: true, name: true, photoUrl: true, bloodGroup: true, idVerificationStatus: true, isSuspended: true } },
      request: { select: { id: true, hospitalName: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
  if (!conversation) notFound();

  const other = conversation.userAId === user.id ? conversation.userB : conversation.userA;
  const [iBlocked, theyBlocked] = await Promise.all([
    db.block.count({ where: { blockerId: user.id, blockedId: other.id } }),
    db.block.count({ where: { blockerId: other.id, blockedId: user.id } }),
  ]);

  await db.message.updateMany({
    where: { conversationId: id, senderId: other.id, readAt: null },
    data: { readAt: await requestTime() },
  });

  const disabledReason = iBlocked
    ? "You blocked this user. Unblock them to send messages."
    : theyBlocked || other.isSuspended
      ? "You can no longer message this user."
      : null;

  return (
    <PageContainer className="max-w-3xl space-y-4">
      <div className="flex items-center gap-2 sm:gap-3">
        <Link href="/messages" aria-label="Back to messages" className="shrink-0 py-1 pr-1 text-sm text-gray-600 hover:underline">
          ←<span className="hidden sm:inline"> Messages</span>
        </Link>
        <Avatar name={other.name} src={other.photoUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1">
            <p className="min-w-0 max-w-full truncate font-semibold">{other.name ?? "User"}</p>
            <Badge tone="red">{bloodGroupLabel(other.bloodGroup)}</Badge>
            {other.idVerificationStatus === "VERIFIED" && <Badge tone="green">Verified</Badge>}
          </div>
          {conversation.request && (
            <Link href={`/requests/${conversation.request.id}`} className="block truncate text-xs text-red-600 hover:underline">
              About request at {conversation.request.hospitalName}
            </Link>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <ReportButton reportedUserId={other.id} />
          <form action={(iBlocked ? unblockUserAction : blockUserAction).bind(null, other.id)}>
            <button type="submit" className={buttonClass.small}>
              {iBlocked ? "Unblock" : "Block"}
            </button>
          </form>
        </div>
      </div>

      <ChatThread
        conversationId={conversation.id}
        currentUserId={user.id}
        disabledReason={disabledReason}
        initialMessages={conversation.messages
          .reverse()
          .map((m) => ({ id: m.id, body: m.body, senderId: m.senderId, createdAt: m.createdAt.toISOString() }))}
      />
      <p className="text-center text-xs text-gray-500">
        Never send money for blood. Blood donation in Bangladesh is voluntary. Report anyone asking for payment.
      </p>
    </PageContainer>
  );
}
