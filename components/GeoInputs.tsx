"use client";

import { useEffect, useState } from "react";
import { buttonClass } from "./ui";

type Coords = { lat: number; lng: number };

function requestPosition(onSuccess: (coords: Coords) => void, onError: (message: string) => void) {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    onError("Location is not supported on this device.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (position) => onSuccess({ lat: position.coords.latitude, lng: position.coords.longitude }),
    (error) => onError(error.code === error.PERMISSION_DENIED ? "Location permission was denied." : "Could not detect your location."),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
  );
}

export function GeoInputs({
  defaultLat,
  defaultLng,
  auto = false,
  label = "Use my current location",
}: {
  defaultLat?: number | null;
  defaultLng?: number | null;
  auto?: boolean;
  label?: string;
}) {
  const [coords, setCoords] = useState<Coords | null>(
    defaultLat != null && defaultLng != null ? { lat: defaultLat, lng: defaultLng } : null,
  );
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!auto) return;
    requestPosition(
      (value) => {
        setCoords(value);
        setStatus("Location captured.");
      },
      (message) => setStatus(message),
    );
  }, [auto]);

  function locate() {
    setStatus("Detecting location…");
    requestPosition(
      (value) => {
        setCoords(value);
        setStatus("Location captured.");
      },
      (message) => setStatus(message),
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input type="hidden" name="latitude" value={coords?.lat ?? ""} />
      <input type="hidden" name="longitude" value={coords?.lng ?? ""} />
      <button type="button" onClick={locate} className={buttonClass.secondary}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M12 21s-7-6.2-7-12a7 7 0 1 1 14 0c0 5.8-7 12-7 12Z" />
          <circle cx="12" cy="9" r="2.5" />
        </svg>
        {label}
      </button>
      <span className="text-xs text-gray-500">
        {coords ? `Lat ${coords.lat.toFixed(4)}, Lng ${coords.lng.toFixed(4)}` : "No location set"}
        {status && ` · ${status}`}
      </span>
    </div>
  );
}
