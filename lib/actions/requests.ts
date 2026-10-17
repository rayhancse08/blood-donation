"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { isValidDistrict } from "@/lib/bd-locations";
import { canDonateTo } from "@/lib/blood";
import { BLOOD_GROUP_VALUES, bloodGroupLabel, URGENCY_VALUES, type BloodGroupValue } from "@/lib/constants";
import { db } from "@/lib/db";
import { isInCooldown } from "@/lib/donation-cycle";
import { alertDonorsForRequest, isBlockedBetween } from "@/lib/donors";
import {
  type ActionState,
  FormError,
  optCoordinates,
  optInt,
  optPhone,
  optStr,
  reqDate,
  reqEnum,
  reqInt,
  reqStr,
  toFormErrorState,
} from "@/lib/form";
import { notifyUsers } from "@/lib/notify";

export async function createRequestAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  let requestId = "";

  try {
    const division = reqStr(formData, "division", "Division", 50);
    const district = reqStr(formData, "district", "District", 50);
    if (!isValidDistrict(division, district)) throw new FormError("Please select a valid district.");

    const neededBy = reqDate(formData, "neededBy", "Needed by date");
    if (neededBy.getTime() < Date.now() - 24 * 60 * 60 * 1000) throw new FormError("The needed-by date cannot be in the past.");

    const facilityId = optStr(formData, "facilityId", 50);
    if (facilityId && !(await db.facility.count({ where: { id: facilityId } }))) throw new FormError("Unknown hospital.");

    const contactPhone = optPhone(formData, "contactPhone", "Contact phone") ?? user.contactPhone ?? user.phone;
    if (!contactPhone) throw new FormError("A contact phone number is required.");

    const coords = optCoordinates(formData);
    const request = await db.bloodRequest.create({
      data: {
        requesterId: user.id,
        patientName: optStr(formData, "patientName", 100),
        bloodGroup: reqEnum(formData, "bloodGroup", BLOOD_GROUP_VALUES, "Blood group"),
        units: reqInt(formData, "units", "Units", 1, 10),
        hospitalName: reqStr(formData, "hospitalName", "Hospital", 150),
        facilityId,
        division,
        district,
        upazila: optStr(formData, "upazila", 100),
        thana: optStr(formData, "thana", 100),
        address: optStr(formData, "address", 300),
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        neededBy,
        urgency: reqEnum(formData, "urgency", URGENCY_VALUES, "Urgency"),
        contactPhone,
        notes: optStr(formData, "notes", 1000),
      },
    });
    requestId = request.id;
    after(() => alertDonorsForRequest(request));
  } catch (error) {
    return toFormErrorState(error);
  }

  redirect(`/requests/${requestId}?created=1`);
}

export async function createEmergencyRequestAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  let requestId = "";

  try {
    const coords = optCoordinates(formData);
    if (!coords && !user.district) {
      throw new FormError("Please allow location access (or set your district in your profile) so we can alert nearby donors.");
    }
    const contactPhone = optPhone(formData, "contactPhone", "Contact phone") ?? user.contactPhone ?? user.phone;
    if (!contactPhone) throw new FormError("A contact phone number is required.");

    const request = await db.bloodRequest.create({
      data: {
        requesterId: user.id,
        bloodGroup: reqEnum(formData, "bloodGroup", BLOOD_GROUP_VALUES, "Blood group"),
        units: optInt(formData, "units", "Units", 1, 10) ?? 1,
        hospitalName: optStr(formData, "hospitalName", 150) ?? "Location shared via GPS",
        patientName: optStr(formData, "patientName", 100),
        division: user.division,
        district: user.district,
        upazila: user.upazila,
        thana: user.thana,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        neededBy: new Date(),
        urgency: "CRITICAL",
        isEmergency: true,
        contactPhone,
        notes: optStr(formData, "notes", 500),
      },
    });
    requestId = request.id;
    after(() => alertDonorsForRequest(request));
  } catch (error) {
    return toFormErrorState(error);
  }

  redirect(`/requests/${requestId}?created=1`);
}

export async function respondToRequestAction(requestId: string, decision: "ACCEPTED" | "DECLINED") {
  const user = await requireUser();
  const request = await db.bloodRequest.findUnique({ where: { id: requestId } });
  if (!request || request.requesterId === user.id) return;
  if (request.status !== "OPEN" && request.status !== "ACCEPTED") return;
  if (await isBlockedBetween(user.id, request.requesterId)) return;

  if (decision === "ACCEPTED") {
    if (!user.isDonor || !user.bloodGroup) return;
    if (!canDonateTo(user.bloodGroup as BloodGroupValue, request.bloodGroup as BloodGroupValue)) return;
    if (isInCooldown(user, new Date())) return;
  }

  await db.requestResponse.upsert({
    where: { requestId_donorId: { requestId, donorId: user.id } },
    create: { requestId, donorId: user.id, status: decision },
    update: { status: decision },
  });

  if (decision === "ACCEPTED") {
    if (request.status === "OPEN") {
      await db.bloodRequest.update({ where: { id: requestId }, data: { status: "ACCEPTED" } });
    }
    await notifyUsers(
      [request.requesterId],
      {
        type: "REQUEST_UPDATE",
        title: "A donor accepted your request",
        body: `${user.name ?? "A donor"} (${bloodGroupLabel(user.bloodGroup)}) accepted your blood request. Their contact details are now visible.`,
        link: `/requests/${requestId}`,
      },
      { sms: request.isEmergency },
    );
  } else if (request.status === "ACCEPTED") {
    const stillAccepted = await db.requestResponse.count({ where: { requestId, status: "ACCEPTED" } });
    if (stillAccepted === 0) await db.bloodRequest.update({ where: { id: requestId }, data: { status: "OPEN" } });
  }

  revalidatePath(`/requests/${requestId}`);
}

export async function updateRequestStatusAction(requestId: string, status: "OPEN" | "FULFILLED" | "CANCELLED") {
  const user = await requireUser();
  const request = await db.bloodRequest.findUnique({
    where: { id: requestId },
    include: { responses: { where: { status: "ACCEPTED" }, select: { donorId: true } } },
  });
  if (!request) return;
  if (request.requesterId !== user.id && user.role !== "ADMIN") return;

  const nextStatus = status === "OPEN" && request.responses.length > 0 ? "ACCEPTED" : status;
  await db.bloodRequest.update({ where: { id: requestId }, data: { status: nextStatus } });

  if (status !== "OPEN" && request.responses.length) {
    await notifyUsers(
      request.responses.map((r) => r.donorId),
      {
        type: "REQUEST_UPDATE",
        title: status === "FULFILLED" ? "Request fulfilled - thank you!" : "Request cancelled",
        body:
          status === "FULFILLED"
            ? `The ${bloodGroupLabel(request.bloodGroup)} request at ${request.hospitalName} has been fulfilled. If you donated, submit your proof to record it.`
            : `The ${bloodGroupLabel(request.bloodGroup)} request at ${request.hospitalName} was cancelled by the requester.`,
        link: status === "FULFILLED" ? "/donations/new" : `/requests/${requestId}`,
      },
    );
  }

  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/requests");
}

export async function resendAlertsAction(requestId: string) {
  const user = await requireUser();
  const request = await db.bloodRequest.findUnique({ where: { id: requestId } });
  if (!request || request.requesterId !== user.id || request.status !== "OPEN") return;
  after(() => alertDonorsForRequest(request));
  revalidatePath(`/requests/${requestId}`);
}
