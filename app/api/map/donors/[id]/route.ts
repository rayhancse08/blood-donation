import { NextResponse, type NextRequest } from "next/server";
import type { DonorDetails } from "@/components/map/types";
import { getCurrentUser } from "@/lib/auth";
import { formatArea } from "@/lib/bd-locations";
import { db } from "@/lib/db";
import { isBlockedBetween, visibleDonorWhere } from "@/lib/donors";
import { ageFrom } from "@/lib/format";
import { distanceBetween } from "@/lib/geo";

function coordinate(value: string | null, limit: number) {
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getCurrentUser();
  if (!viewer) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { id } = await params;
  const now = new Date();
  const isSelf = id === viewer.id;

  const donor = await db.user.findFirst({
    where: isSelf ? { id } : { id, ...visibleDonorWhere(now) },
    select: {
      id: true,
      name: true,
      photoUrl: true,
      bloodGroup: true,
      dateOfBirth: true,
      gender: true,
      division: true,
      district: true,
      upazila: true,
      thana: true,
      latitude: true,
      longitude: true,
      lastDonationAt: true,
      contactPhone: true,
      phone: true,
      idVerificationStatus: true,
      _count: { select: { donations: { where: { status: "VERIFIED" } } } },
    },
  });
  if (!donor || (!isSelf && (await isBlockedBetween(viewer.id, donor.id)))) {
    return NextResponse.json({ error: "Donor not available" }, { status: 404 });
  }

  // Contact details are only revealed once the donor has accepted one of the viewer's requests.
  const accepted =
    isSelf ||
    (await db.requestResponse.count({
      where: {
        donorId: donor.id,
        status: "ACCEPTED",
        request: { requesterId: viewer.id, status: { in: ["OPEN", "ACCEPTED", "FULFILLED"] } },
      },
    })) > 0;

  const lat = coordinate(request.nextUrl.searchParams.get("lat"), 90);
  const lng = coordinate(request.nextUrl.searchParams.get("lng"), 180);
  const origin = lat != null && lng != null ? { lat, lng } : viewer.latitude != null && viewer.longitude != null ? { lat: viewer.latitude, lng: viewer.longitude } : null;

  const details: DonorDetails = {
    id: donor.id,
    name: donor.name ?? "Donor",
    photoUrl: donor.photoUrl,
    bloodGroup: donor.bloodGroup ?? "",
    age: ageFrom(donor.dateOfBirth, now),
    gender: donor.gender,
    area: formatArea(donor),
    lastDonationAt: donor.lastDonationAt?.toISOString() ?? null,
    donationCount: donor._count.donations,
    verified: donor.idVerificationStatus === "VERIFIED",
    distanceKm: distanceBetween(origin, donor.latitude, donor.longitude),
    contactPhone: accepted ? (donor.contactPhone ?? donor.phone) : null,
    isSelf,
  };

  return NextResponse.json(details, { headers: { "Cache-Control": "no-store" } });
}
