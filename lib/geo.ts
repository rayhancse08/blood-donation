export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineKm(a: LatLng, b: LatLng) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function boundingBox(center: LatLng, radiusKm: number) {
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.max(Math.cos(toRad(center.lat)), 0.01));
  return {
    minLat: center.lat - dLat,
    maxLat: center.lat + dLat,
    minLng: center.lng - dLng,
    maxLng: center.lng + dLng,
  };
}

/** Rounds to 2 decimals (~1.1 km) so that only the area, not the exact address, is stored. */
export function approximateCoordinate(value: number) {
  return Math.round(value * 100) / 100;
}

export function applyPrecision(latitude: number, longitude: number, precision: "EXACT" | "APPROXIMATE") {
  return precision === "APPROXIMATE"
    ? { latitude: approximateCoordinate(latitude), longitude: approximateCoordinate(longitude) }
    : { latitude, longitude };
}

export function distanceBetween(
  origin: LatLng | null | undefined,
  lat: number | null | undefined,
  lng: number | null | undefined,
): number | null {
  if (!origin || lat == null || lng == null) return null;
  return haversineKm(origin, { lat, lng });
}

export function formatDistance(km: number | null | undefined) {
  if (km == null) return null;
  if (km < 1) return `${Math.max(100, Math.round((km * 1000) / 100) * 100)} m`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

export function mapsLink(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export function userOrigin(user: { latitude: number | null; longitude: number | null } | null | undefined): LatLng | null {
  return user?.latitude != null && user.longitude != null ? { lat: user.latitude, lng: user.longitude } : null;
}
