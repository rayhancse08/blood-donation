import type { BloodRequest, Prisma } from "@/generated/prisma/client";
import { canDonateTo, compatibleDonorGroups, recipientGroupsFor } from "./blood";
import { bloodGroupLabel, type BloodGroupValue } from "./constants";
import { db } from "./db";
import { boundingBox, haversineKm } from "./geo";
import { notifyUsers } from "./notify";

/** Donors that should be visible on the map / receive alerts right now. */
export function visibleDonorWhere(now: Date): Prisma.UserWhereInput {
  return {
    isDonor: true,
    isAvailable: true,
    isSuspended: false,
    profileCompleted: true,
    OR: [{ hiddenUntil: null }, { hiddenUntil: { lte: now } }],
  };
}

export async function blockedUserIds(userId: string) {
  const blocks = await db.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  return new Set(blocks.map((b) => (b.blockerId === userId ? b.blockedId : b.blockerId)));
}

export async function isBlockedBetween(a: string, b: string) {
  const count = await db.block.count({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
  });
  return count > 0;
}

type MatchInput = Pick<BloodRequest, "bloodGroup" | "latitude" | "longitude" | "district" | "requesterId">;

export async function findMatchingDonors(request: MatchInput, radiusKm: number, limit = 100) {
  const now = new Date();
  const where: Prisma.UserWhereInput = {
    ...visibleDonorWhere(now),
    bloodGroup: { in: compatibleDonorGroups(request.bloodGroup as BloodGroupValue) },
    id: { not: request.requesterId },
  };
  const select = { id: true, latitude: true, longitude: true } as const;

  let donors: { id: string; distanceKm: number | null }[] = [];

  if (request.latitude != null && request.longitude != null) {
    const origin = { lat: request.latitude, lng: request.longitude };
    const box = boundingBox(origin, radiusKm);
    const nearby = await db.user.findMany({
      where: {
        ...where,
        latitude: { gte: box.minLat, lte: box.maxLat },
        longitude: { gte: box.minLng, lte: box.maxLng },
      },
      select,
      take: limit * 3,
    });
    donors = nearby
      .map((d) => ({ id: d.id, distanceKm: haversineKm(origin, { lat: d.latitude!, lng: d.longitude! }) }))
      .filter((d) => d.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  if (donors.length === 0 && request.district) {
    const inDistrict = await db.user.findMany({ where: { ...where, district: request.district }, select, take: limit });
    donors = inDistrict.map((d) => ({ id: d.id, distanceKm: null }));
  }

  const blocked = await blockedUserIds(request.requesterId);
  return donors.filter((d) => !blocked.has(d.id)).slice(0, limit);
}

export async function alertDonorsForRequest(request: BloodRequest) {
  const radius = request.isEmergency ? 25 : 10;
  const donors = await findMatchingDonors(request, radius, request.isEmergency ? 200 : 100);
  const group = bloodGroupLabel(request.bloodGroup);

  await notifyUsers(
    donors.map((d) => d.id),
    {
      type: request.isEmergency ? "EMERGENCY" : "BLOOD_REQUEST",
      title: request.isEmergency ? `URGENT: ${group} blood needed now` : `${group} blood needed near you`,
      body: `${request.units} unit(s) needed at ${request.hospitalName}${request.district ? `, ${request.district}` : ""}. Tap to accept or decline.`,
      link: `/requests/${request.id}`,
    },
    { sms: request.isEmergency },
  );

  await db.bloodRequest.update({ where: { id: request.id }, data: { alertedCount: donors.length } });
  return donors.length;
}

/** Emergency "giving" mode: a donor tells open emergency requesters nearby that they can donate now. */
export async function alertRequestersForDonor(donor: {
  id: string;
  name: string | null;
  bloodGroup: BloodGroupValue;
  latitude: number | null;
  longitude: number | null;
  district: string | null;
}) {
  const requests = await db.bloodRequest.findMany({
    where: {
      status: { in: ["OPEN", "ACCEPTED"] },
      OR: [{ isEmergency: true }, { urgency: "CRITICAL" }],
      bloodGroup: { in: recipientGroupsFor(donor.bloodGroup) },
      requesterId: { not: donor.id },
    },
    select: { id: true, requesterId: true, latitude: true, longitude: true, district: true, bloodGroup: true },
    take: 200,
  });

  const blocked = await blockedUserIds(donor.id);
  const origin = donor.latitude != null && donor.longitude != null ? { lat: donor.latitude, lng: donor.longitude } : null;

  const matches = requests.filter((r) => {
    if (blocked.has(r.requesterId)) return false;
    if (!canDonateTo(donor.bloodGroup, r.bloodGroup as BloodGroupValue)) return false;
    if (origin && r.latitude != null && r.longitude != null) {
      return haversineKm(origin, { lat: r.latitude, lng: r.longitude }) <= 25;
    }
    return !!donor.district && r.district === donor.district;
  });

  for (const request of matches) {
    await notifyUsers(
      [request.requesterId],
      {
        type: "EMERGENCY",
        title: `A ${bloodGroupLabel(donor.bloodGroup)} donor is ready now`,
        body: `${donor.name ?? "A donor"} is available to donate immediately. Open your request to see them.`,
        link: `/requests/${request.id}`,
      },
      { sms: true },
    );
  }

  return matches.length;
}
