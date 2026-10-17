"use client";

import { useState, useSyncExternalStore } from "react";
import { buttonClass } from "./ui";

function readPermission(): NotificationPermission | "unsupported" {
  return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
}

export function BrowserNotificationsToggle() {
  const initial = useSyncExternalStore(
    () => () => {},
    readPermission,
    () => "default" as const,
  );
  const [permission, setPermission] = useState<NotificationPermission | "unsupported" | null>(null);
  const current = permission ?? initial;

  if (current === "unsupported") return null;
  if (current === "granted") return <p className="text-sm text-green-700">Browser alerts are enabled for urgent notifications.</p>;
  if (current === "denied") {
    return <p className="text-sm text-gray-600">Browser alerts are blocked. Enable notifications for this site in your browser settings.</p>;
  }

  return (
    <button
      type="button"
      className={buttonClass.secondary}
      onClick={async () => setPermission(await Notification.requestPermission())}
    >
      Enable browser alerts for emergencies
    </button>
  );
}
