"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isBlockedBetween } from "@/lib/donors";

export async function startConversationAction(formData: FormData) {
  const user = await requireUser();
  const otherUserId = String(formData.get("otherUserId") ?? "");
  const requestId = String(formData.get("requestId") ?? "") || null;
  if (!otherUserId || otherUserId === user.id) redirect("/messages");

  const other = await db.user.findFirst({ where: { id: otherUserId, isSuspended: false }, select: { id: true } });
  if (!other || (await isBlockedBetween(user.id, otherUserId))) redirect("/messages?error=unavailable");

  const [userAId, userBId] = [user.id, otherUserId].sort() as [string, string];
  const conversation = await db.conversation.upsert({
    where: { userAId_userBId: { userAId, userBId } },
    create: { userAId, userBId, requestId },
    update: requestId ? { requestId } : {},
  });

  redirect(`/messages/${conversation.id}`);
}
