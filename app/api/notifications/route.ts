import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { releaseExpiredCooldowns } from "@/lib/donation-cycle";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  if (user.hiddenUntil && user.hiddenUntil <= new Date()) {
    await releaseExpiredCooldowns(user.id);
  }

  const [unreadCount, latest] = await Promise.all([
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    db.notification.findMany({
      where: { userId: user.id, readAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, type: true, title: true, body: true, link: true },
    }),
  ]);

  return NextResponse.json({ unreadCount, latest }, { headers: { "Cache-Control": "no-store" } });
}
