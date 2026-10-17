import type { Metadata } from "next";
import { BrowserNotificationsToggle } from "@/components/BrowserNotificationsToggle";
import { Badge, buttonClass, cn, EmptyState, PageContainer, PageHeader } from "@/components/ui";
import { markAllNotificationsReadAction, openNotificationAction } from "@/lib/actions/notifications";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { requestTime } from "@/lib/request-time";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser({ allowIncompleteProfile: true });
  const now = await requestTime();
  const notifications = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        title="Notifications"
        actions={
          <form action={markAllNotificationsReadAction}>
            <button type="submit" className={buttonClass.secondary}>
              Mark all as read
            </button>
          </form>
        }
      />
      <div className="mb-4">
        <BrowserNotificationsToggle />
      </div>
      {notifications.length === 0 ? (
        <EmptyState title="No notifications yet" />
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {notifications.map((n) => (
            <li key={n.id}>
              <form action={openNotificationAction.bind(null, n.id)}>
                <button type="submit" className={cn("flex w-full gap-3 p-4 text-left hover:bg-gray-50", !n.readAt && "bg-red-50/50")}>
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-red-600")} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{n.title}</span>
                      {n.type === "EMERGENCY" && <Badge tone="red">Emergency</Badge>}
                    </span>
                    <span className="block text-sm text-gray-600">{n.body}</span>
                    <span className="block text-xs text-gray-400">{timeAgo(n.createdAt, now)}</span>
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
