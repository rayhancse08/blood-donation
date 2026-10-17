"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const STORAGE_KEY = "bloodapp.liveLocation";
const MIN_INTERVAL_MS = 30_000;
const MIN_DISTANCE_M = 50;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function setEnabled(value: boolean) {
  localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  listeners.forEach((listener) => listener());
}

function metersBetween(a: GeolocationCoordinates, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const x = (b.lng - a.longitude) * rad * Math.cos(((a.latitude + b.lat) / 2) * rad);
  const y = (b.lat - a.latitude) * rad;
  return Math.sqrt(x * x + y * y) * 6_371_000;
}

/** Shares the donor's live location while they are available and have opted in. */
export function LiveLocationSharer() {
  const enabled = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(STORAGE_KEY) === "1",
    () => false,
  );
  const [status, setStatus] = useState<"idle" | "sharing" | "error">("idle");
  const last = useRef<{ at: number; lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!enabled || !("geolocation" in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const now = Date.now();
        const previous = last.current;
        const moved = !previous || metersBetween(position.coords, previous) > MIN_DISTANCE_M;
        if (previous && !moved && now - previous.at < MIN_INTERVAL_MS) return;

        last.current = { at: now, lat: position.coords.latitude, lng: position.coords.longitude };
        try {
          const response = await fetch("/api/location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
          });
          setStatus(response.ok ? "sharing" : "error");
        } catch {
          setStatus("error");
        }
      },
      () => setStatus("error"),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 30_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled]);

  const dot = !enabled ? "bg-gray-400" : status === "error" ? "bg-yellow-500" : "bg-green-500 animate-pulse";

  return (
    <button
      type="button"
      onClick={() => setEnabled(!enabled)}
      title={enabled ? "Live location sharing is on. Click to stop." : "Share your live location while you are available"}
      aria-pressed={enabled}
      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 sm:px-2.5"
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      Live<span className="hidden sm:inline"> {enabled ? "on" : "off"}</span>
    </button>
  );
}
