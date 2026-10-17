import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import type { DonorPin, RequestPin } from "@/components/map/types";
import { getCurrentUser } from "@/lib/auth";
import { compatibleDonorGroups, isBloodGroup, recipientGroupsFor } from "@/lib/blood";
import { db } from "@/lib/db";
import { blockedUserIds, visibleDonorWhere } from "@/lib/donors";
import { approximateCoordinate } from "@/lib/geo";

const MAX_DONORS = 500;
const MAX_REQUESTS = 300;

function text(value: string | null, max = 100) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed.slice(0, max) : null;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const user = await getCurrentUser();
  const now = new Date();

  const bloodGroupParam = params.get("bloodGroup");
  const bloodGroup = isBloodGroup(bloodGroupParam) ? bloodGroupParam : null;
  const compatible = params.get("compatible") === "1";
  const show = params.get("show") === "donors" || params.get("show") === "requests" ? params.get("show") : "all";

  const area = {
    ...(text(params.get("division")) ? { division: text(params.get("division")) } : {}),
    ...(text(params.get("district")) ? { district: text(params.get("district")) } : {}),
    ...(text(params.get("upazila")) ? { upazila: { contains: text(params.get("upazila"))!, mode: "insensitive" as const } } : {}),
    ...(text(params.get("thana")) ? { thana: { contains: text(params.get("thana"))!, mode: "insensitive" as const } } : {}),
  };

  const blocked = user ? await blockedUserIds(user.id) : new Set<string>();
  const excluded = [...blocked];

  const donorWhere: Prisma.UserWhereInput = {
    ...visibleDonorWhere(now),
    ...area,
    latitude: { not: null },
    longitude: { not: null },
    ...(bloodGroup ? { bloodGroup: compatible ? { in: compatibleDonorGroups(bloodGroup) } : bloodGroup } : { bloodGroup: { not: null } }),
    ...(excluded.length ? { id: { notIn: excluded } } : {}),
  };

  const requestWhere: Prisma.BloodRequestWhereInput = {
    ...area,
    status: { in: ["OPEN", "ACCEPTED"] },
    latitude: { not: null },
    longitude: { not: null },
    neededBy: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
    ...(bloodGroup ? { bloodGroup: compatible ? { in: recipientGroupsFor(bloodGroup) } : bloodGroup } : {}),
    ...(excluded.length ? { requesterId: { notIn: excluded } } : {}),
  };

  const [donorRows, requestRows] = await Promise.all([
    show === "requests"
      ? []
      : db.user.findMany({
          where: donorWhere,
          select: { id: true, name: true, bloodGroup: true, latitude: true, longitude: true },
          orderBy: { locationUpdatedAt: "desc" },
          take: MAX_DONORS,
        }),
    show === "donors"
      ? []
      : db.bloodRequest.findMany({
          where: requestWhere,
          select: {
            id: true,
            bloodGroup: true,
            hospitalName: true,
            units: true,
            urgency: true,
            isEmergency: true,
            status: true,
            district: true,
            neededBy: true,
            latitude: true,
            longitude: true,
          },
          orderBy: [{ isEmergency: "desc" }, { createdAt: "desc" }],
          take: MAX_REQUESTS,
        }),
  ]);

  // Anonymous visitors only ever see area-level positions.
  const position = (value: number) => (user ? value : approximateCoordinate(value));

  const donors: DonorPin[] = donorRows.map((d) => ({
    id: d.id,
    name: d.name?.split(/\s+/)[0] ?? "Donor",
    bloodGroup: d.bloodGroup!,
    lat: position(d.latitude!),
    lng: position(d.longitude!),
  }));

  const requests: RequestPin[] = requestRows.map((r) => ({
    id: r.id,
    bloodGroup: r.bloodGroup,
    hospitalName: r.hospitalName,
    units: r.units,
    urgency: r.urgency,
    isEmergency: r.isEmergency,
    status: r.status,
    district: r.district,
    neededBy: r.neededBy.toISOString(),
    lat: r.latitude!,
    lng: r.longitude!,
  }));

  return NextResponse.json({ donors, requests }, { headers: { "Cache-Control": "no-store" } });
}
