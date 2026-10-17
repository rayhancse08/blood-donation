import { db } from "./db";
import { addDays } from "./format";
import { notifyUsers } from "./notify";

export const DONATION_COOLDOWN_DAYS = 90;

export function cooldownEndsAt(donatedAt: Date) {
  return addDays(donatedAt, DONATION_COOLDOWN_DAYS);
}

export function isInCooldown(user: { hiddenUntil: Date | null }, now: Date) {
  return !!user.hiddenUntil && user.hiddenUntil > now;
}

/**
 * Makes donors whose 3-month rest period has ended visible again and asks them
 * to confirm their availability. Optionally scoped to a single user.
 */
export async function releaseExpiredCooldowns(userId?: string) {
  const users = await db.user.findMany({
    where: { hiddenUntil: { lte: new Date() }, ...(userId ? { id: userId } : {}) },
    select: { id: true, isDonor: true },
  });
  if (users.length === 0) return 0;

  const ids = users.map((u) => u.id);
  const donorIds = users.filter((u) => u.isDonor).map((u) => u.id);

  await db.user.updateMany({ where: { id: { in: ids } }, data: { hiddenUntil: null } });
  if (donorIds.length) {
    await db.user.updateMany({ where: { id: { in: donorIds } }, data: { isAvailable: true } });
    await notifyUsers(donorIds, {
      type: "AVAILABILITY",
      title: "You can donate again",
      body: "Your 3-month rest period is over and you are visible on the map again. Please confirm you are available, or switch availability off.",
      link: "/dashboard",
    });
  }
  return ids.length;
}
