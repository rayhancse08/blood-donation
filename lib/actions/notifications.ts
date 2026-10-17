"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { safeNext } from "@/lib/form";

export async function markAllNotificationsReadAction() {
  const user = await requireUser({ allowIncompleteProfile: true });
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/notifications");
}

export async function openNotificationAction(notificationId: string) {
  const user = await requireUser({ allowIncompleteProfile: true });
  const notification = await db.notification.findFirst({ where: { id: notificationId, userId: user.id } });
  if (!notification) redirect("/notifications");
  if (!notification.readAt) {
    await db.notification.update({ where: { id: notification.id }, data: { readAt: new Date() } });
  }
  redirect(safeNext(notification.link) ?? "/notifications");
}
