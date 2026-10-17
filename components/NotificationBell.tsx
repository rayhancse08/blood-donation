"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type LatestNotification = { id: string; type: string; title: string; body: string; link: string | null };

export function NotificationBell() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const seen = new Set<string>();
    let firstPoll = true;
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch("/api/notifications", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { unreadCount: number; latest: LatestNotification[] };
        if (cancelled) return;
        setCount(data.unreadCount);

        for (const item of data.latest) {
          if (seen.has(item.id)) continue;
          seen.add(item.id);
          const canNotify = typeof Notification !== "undefined" && Notification.permission === "granted";
          if (!firstPoll && canNotify) {
            const notification = new Notification(item.title, { body: item.body, tag: item.id });
            notification.onclick = () => {
              window.focus();
              if (item.link) window.location.href = item.link;
            };
          }
        }
        firstPoll = false;
      } catch {
        // network errors are retried on the next poll
      }
    }

    poll();
    const timer = setInterval(poll, 20000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <Link href="/notifications" aria-label="Notifications" className="relative rounded-lg p-2 text-gray-700 hover:bg-gray-100">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
