"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import { bloodGroupLabel } from "@/lib/constants";
import type { DonorPin, RequestPin, Selection } from "./types";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

function pinIcon(group: string, label: string, variant: "donor" | "request" | "emergency" | "me" | "selected") {
  return L.divIcon({
    className: "map-pin",
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    html: `<div class="map-pin-body map-pin-${variant}"><span class="map-pin-group">${escapeHtml(group)}</span><span class="map-pin-label">${escapeHtml(label)}</span></div>`,
  });
}

function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, 13, { duration: 0.8 });
  }, [target, map]);
  return null;
}

export default function LeafletMap({
  center,
  donors,
  requests,
  me,
  selected,
  onSelect,
}: {
  center: [number, number];
  donors: DonorPin[];
  requests: RequestPin[];
  me: [number, number] | null;
  selected: Selection | null;
  onSelect: (selection: Selection) => void;
}) {
  const donorMarkers = useMemo(
    () =>
      donors.map((donor) => ({
        donor,
        icon: pinIcon(
          bloodGroupLabel(donor.bloodGroup),
          donor.name,
          selected?.kind === "donor" && selected.id === donor.id ? "selected" : "donor",
        ),
      })),
    [donors, selected],
  );

  const requestMarkers = useMemo(
    () =>
      requests.map((request) => ({
        request,
        icon: pinIcon(
          bloodGroupLabel(request.bloodGroup),
          request.isEmergency ? "EMERGENCY" : `${request.units} unit(s)`,
          selected?.kind === "request" && selected.id === request.id ? "selected" : request.isEmergency ? "emergency" : "request",
        ),
      })),
    [requests, selected],
  );

  return (
    <MapContainer center={center} zoom={11} scrollWheelZoom className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FlyTo target={me} />
      {me && <Marker position={me} icon={pinIcon("You", "", "me")} />}
      {donorMarkers.map(({ donor, icon }) => (
        <Marker
          key={`donor-${donor.id}`}
          position={[donor.lat, donor.lng]}
          icon={icon}
          eventHandlers={{ click: () => onSelect({ kind: "donor", id: donor.id }) }}
        />
      ))}
      {requestMarkers.map(({ request, icon }) => (
        <Marker
          key={`request-${request.id}`}
          position={[request.lat, request.lng]}
          icon={icon}
          eventHandlers={{ click: () => onSelect({ kind: "request", id: request.id }) }}
        />
      ))}
    </MapContainer>
  );
}
