"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { REPORT_REASONS } from "@/lib/constants";
import { db } from "@/lib/db";
import { type ActionState, optStr, reqEnum, toFormErrorState } from "@/lib/form";
import { notifyAdmins } from "@/lib/notify";

export async function reportAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  try {
    const reportedUserId = optStr(formData, "reportedUserId", 50);
    const requestId = optStr(formData, "requestId", 50);
    if (!reportedUserId && !requestId) return { error: "Nothing to report." };
    if (reportedUserId === user.id) return { error: "You cannot report yourself." };

    await db.report.create({
      data: {
        reporterId: user.id,
        reportedUserId,
        requestId,
        reason: reqEnum(formData, "reason", REPORT_REASONS, "Reason"),
        details: optStr(formData, "details", 1000),
      },
    });

    if (reportedUserId && formData.get("block") === "on") {
      await db.block.upsert({
        where: { blockerId_blockedId: { blockerId: user.id, blockedId: reportedUserId } },
        create: { blockerId: user.id, blockedId: reportedUserId },
        update: {},
      });
    }

    await notifyAdmins({
      type: "SYSTEM",
      title: "New report submitted",
      body: "A user report is waiting for moderation.",
      link: "/admin/reports",
    });
  } catch (error) {
    return toFormErrorState(error);
  }
  return { success: "Thank you. Our team will review this report." };
}

export async function blockUserAction(userId: string) {
  const user = await requireUser();
  if (userId === user.id) return;
  await db.block.upsert({
    where: { blockerId_blockedId: { blockerId: user.id, blockedId: userId } },
    create: { blockerId: user.id, blockedId: userId },
    update: {},
  });
  revalidatePath("/", "layout");
}

export async function unblockUserAction(userId: string) {
  const user = await requireUser();
  await db.block.deleteMany({ where: { blockerId: user.id, blockedId: userId } });
  revalidatePath("/", "layout");
}
