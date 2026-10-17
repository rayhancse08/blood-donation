import type { NotificationType } from "@/generated/prisma/client";
import { db } from "./db";
import { sendSms } from "./sms";
import { appUrl } from "./url";

export type NotificationInput = {
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
};

export async function notifyUsers(userIds: string[], input: NotificationInput, options: { sms?: boolean } = {}) {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return;

  await db.notification.createMany({
    data: ids.map((userId) => ({
      userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
    })),
  });

  if (options.sms) {
    const users = await db.user.findMany({
      where: { id: { in: ids } },
      select: { phone: true, contactPhone: true },
    });
    const text = `${input.title}: ${input.body}${input.link ? ` ${appUrl(input.link)}` : ""}`;
    await Promise.allSettled(
      users.map((user) => {
        const to = user.contactPhone ?? user.phone;
        return to ? sendSms(to, text) : Promise.resolve();
      }),
    );
  }
}

export async function notifyAdmins(input: NotificationInput) {
  const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  await notifyUsers(
    admins.map((admin) => admin.id),
    input,
  );
}
