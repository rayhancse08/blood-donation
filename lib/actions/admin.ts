"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/auth";
import {
  BLOOD_GROUP_VALUES,
  CONTENT_TYPE_VALUES,
  FACILITY_TYPE_VALUES,
  LANGUAGE_VALUES,
  type BloodGroupValue,
} from "@/lib/constants";
import { db } from "@/lib/db";
import { cooldownEndsAt } from "@/lib/donation-cycle";
import {
  type ActionState,
  bool,
  getFile,
  optCoordinates,
  optDate,
  optInt,
  optNumber,
  optStr,
  reqEnum,
  reqStr,
  slugify,
  toFormErrorState,
} from "@/lib/form";
import { formatDate } from "@/lib/format";
import { toPoisha } from "@/lib/money";
import { notifyUsers } from "@/lib/notify";
import { fileUrl, saveUpload } from "@/lib/storage";

// ----------------------------------------------------------------------------
// Users
// ----------------------------------------------------------------------------

export async function setUserSuspendedAction(userId: string, suspended: boolean) {
  const admin = await requireAdmin();
  if (userId === admin.id) return;
  await db.user.update({ where: { id: userId }, data: { isSuspended: suspended, ...(suspended ? { isAvailable: false } : {}) } });
  if (suspended) await db.session.deleteMany({ where: { userId } });
  revalidatePath("/admin/users");
}

export async function setUserRoleAction(userId: string, role: "USER" | "ADMIN") {
  const admin = await requireAdmin();
  if (userId === admin.id) return;
  await db.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/admin/users");
}

// ----------------------------------------------------------------------------
// Verification review
// ----------------------------------------------------------------------------

export async function reviewDonationAction(donationId: string, approve: boolean, formData: FormData) {
  const admin = await requireAdmin();
  const donation = await db.donation.findUnique({ where: { id: donationId }, include: { donor: true } });
  if (!donation || donation.status !== "PENDING") return;

  const note = optStr(formData, "note", 500);
  await db.donation.update({
    where: { id: donationId },
    data: { status: approve ? "VERIFIED" : "REJECTED", reviewNote: note, reviewedById: admin.id, reviewedAt: new Date() },
  });

  if (approve) {
    const now = new Date();
    const hiddenUntil = cooldownEndsAt(donation.donatedAt);
    const lastDonationAt =
      donation.donor.lastDonationAt && donation.donor.lastDonationAt > donation.donatedAt
        ? donation.donor.lastDonationAt
        : donation.donatedAt;

    await db.user.update({
      where: { id: donation.donorId },
      data: {
        lastDonationAt,
        ...(hiddenUntil > now && (!donation.donor.hiddenUntil || donation.donor.hiddenUntil < hiddenUntil)
          ? { hiddenUntil, isAvailable: false }
          : {}),
      },
    });

    if (donation.requestId) {
      await db.bloodRequest.updateMany({
        where: { id: donation.requestId, status: { in: ["OPEN", "ACCEPTED"] } },
        data: { status: "FULFILLED" },
      });
    }

    await notifyUsers([donation.donorId], {
      type: "DONATION",
      title: "Donation verified - thank you!",
      body:
        hiddenUntil > now
          ? `Your donation on ${formatDate(donation.donatedAt)} is verified. For your health, you are hidden from the map until ${formatDate(hiddenUntil)}.`
          : `Your donation on ${formatDate(donation.donatedAt)} is verified and added to your history.`,
      link: "/donations",
    });
  } else {
    await notifyUsers([donation.donorId], {
      type: "DONATION",
      title: "Donation proof not accepted",
      body: note ? `Reason: ${note}` : "Please submit a clearer document from the hospital or blood bank.",
      link: "/donations",
    });
  }

  revalidatePath("/admin/verifications");
}

export async function reviewIdentityAction(userId: string, approve: boolean, formData: FormData) {
  await requireAdmin();
  const note = optStr(formData, "note", 500);
  await db.user.update({
    where: { id: userId },
    data: {
      idVerificationStatus: approve ? "VERIFIED" : "REJECTED",
      idVerifiedAt: approve ? new Date() : null,
      idReviewNote: note,
    },
  });
  await notifyUsers([userId], {
    type: "SYSTEM",
    title: approve ? "Identity verified" : "Identity verification rejected",
    body: approve ? "Your profile now shows a verified badge." : (note ?? "Please re-submit your identity details."),
    link: "/profile",
  });
  revalidatePath("/admin/verifications");
}

// ----------------------------------------------------------------------------
// Requests & reports
// ----------------------------------------------------------------------------

export async function adminCancelRequestAction(requestId: string) {
  await requireAdmin();
  const request = await db.bloodRequest.update({ where: { id: requestId }, data: { status: "CANCELLED" } });
  await notifyUsers([request.requesterId], {
    type: "REQUEST_UPDATE",
    title: "Your request was closed by a moderator",
    body: "Contact support if you think this was a mistake.",
    link: `/requests/${requestId}`,
  });
  revalidatePath("/admin/requests");
}

export async function resolveReportAction(reportId: string, status: "RESOLVED" | "DISMISSED", formData: FormData) {
  await requireAdmin();
  const report = await db.report.update({
    where: { id: reportId },
    data: { status, adminNote: optStr(formData, "note", 500), resolvedAt: new Date() },
  });
  if (status === "RESOLVED" && bool(formData, "suspend") && report.reportedUserId) {
    await db.user.update({ where: { id: report.reportedUserId }, data: { isSuspended: true, isAvailable: false } });
    await db.session.deleteMany({ where: { userId: report.reportedUserId } });
  }
  if (status === "RESOLVED" && bool(formData, "cancelRequest") && report.requestId) {
    await db.bloodRequest.update({ where: { id: report.requestId }, data: { status: "CANCELLED" } });
  }
  revalidatePath("/admin/reports");
}

// ----------------------------------------------------------------------------
// Facilities, partners, doctors & medicines
// ----------------------------------------------------------------------------

export async function reviewPartnerAction(facilityId: string, status: "APPROVED" | "REJECTED" | "SUSPENDED") {
  await requireAdmin();
  const facility = await db.facility.update({
    where: { id: facilityId },
    data: {
      partnerStatus: status,
      isActive: status === "APPROVED",
      ...(status === "APPROVED" ? { licenseVerified: true } : {}),
    },
  });
  if (facility.ownerId) {
    await notifyUsers([facility.ownerId], {
      type: "PARTNER",
      title: status === "APPROVED" ? "Partnership approved" : status === "REJECTED" ? "Partnership application rejected" : "Partnership suspended",
      body:
        status === "APPROVED"
          ? `${facility.name} is now live. Customers can find you, pay in-app and receive your discount.`
          : `${facility.name} is not active. Please contact support for details.`,
      link: `/partner/${facility.id}`,
    });
  }
  revalidatePath("/admin/facilities");
}

export async function toggleFacilityActiveAction(facilityId: string) {
  await requireAdmin();
  const facility = await db.facility.findUnique({ where: { id: facilityId } });
  if (!facility) return;
  await db.facility.update({ where: { id: facilityId }, data: { isActive: !facility.isActive } });
  revalidatePath("/admin/facilities");
}

export async function createFacilityAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    const coords = optCoordinates(formData);
    const discountPercent = optInt(formData, "discountPercent", "Discount", 0, 50) ?? 0;
    await db.facility.create({
      data: {
        type: reqEnum(formData, "type", FACILITY_TYPE_VALUES, "Type"),
        name: reqStr(formData, "name", "Name", 150),
        description: optStr(formData, "description", 1000),
        phone: optStr(formData, "phone", 30),
        email: optStr(formData, "email", 150),
        website: optStr(formData, "website", 200),
        division: optStr(formData, "division", 50),
        district: optStr(formData, "district", 50),
        upazila: optStr(formData, "upazila", 100),
        thana: optStr(formData, "thana", 100),
        address: optStr(formData, "address", 300),
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        openingHours: optStr(formData, "openingHours", 100),
        is24Hours: bool(formData, "is24Hours"),
        services: (optStr(formData, "services", 500) ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        partnerStatus: bool(formData, "partner") ? "APPROVED" : "NONE",
        discountPercent,
        discountTerms: optStr(formData, "discountTerms", 1000),
      },
    });
  } catch (error) {
    return toFormErrorState(error);
  }
  revalidatePath("/admin/facilities");
  return { success: "Facility added to the directory." };
}

export async function createDoctorAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    const coords = optCoordinates(formData);
    const fee = optNumber(formData, "consultationFee", "Consultation fee", 0, 100_000);
    await db.doctor.create({
      data: {
        name: reqStr(formData, "name", "Name", 120),
        speciality: reqStr(formData, "speciality", "Speciality", 120),
        qualifications: optStr(formData, "qualifications", 300),
        bio: optStr(formData, "bio", 1000),
        phone: optStr(formData, "phone", 30),
        facilityId: optStr(formData, "facilityId", 50),
        chamberName: optStr(formData, "chamberName", 150),
        chamberAddress: optStr(formData, "chamberAddress", 300),
        division: optStr(formData, "division", 50),
        district: optStr(formData, "district", 50),
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        visitingHours: optStr(formData, "visitingHours", 150),
        consultationFee: fee != null ? toPoisha(fee) : null,
      },
    });
  } catch (error) {
    return toFormErrorState(error);
  }
  revalidatePath("/admin/doctors");
  return { success: "Doctor added." };
}

export async function toggleDoctorActiveAction(doctorId: string) {
  await requireAdmin();
  const doctor = await db.doctor.findUnique({ where: { id: doctorId } });
  if (!doctor) return;
  await db.doctor.update({ where: { id: doctorId }, data: { isActive: !doctor.isActive } });
  revalidatePath("/admin/doctors");
}

export async function createMedicineAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    await db.medicine.create({
      data: {
        name: reqStr(formData, "name", "Name", 120),
        genericName: optStr(formData, "genericName", 120),
        manufacturer: optStr(formData, "manufacturer", 120),
        strength: optStr(formData, "strength", 50),
        form: optStr(formData, "form", 50),
        description: optStr(formData, "description", 1000),
        usage: optStr(formData, "usage", 1000),
        sideEffects: optStr(formData, "sideEffects", 1000),
        requiresPrescription: bool(formData, "requiresPrescription"),
      },
    });
  } catch (error) {
    return toFormErrorState(error);
  }
  revalidatePath("/admin/medicines");
  return { success: "Medicine added to the catalogue." };
}

// ----------------------------------------------------------------------------
// Awareness content & notifications
// ----------------------------------------------------------------------------

export async function saveContentAction(contentId: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  let savedId = contentId;

  try {
    const title = reqStr(formData, "title", "Title", 200);
    const cover = getFile(formData, "cover");
    const coverUrl = cover ? fileUrl(await saveUpload(cover, "content", admin.id, { imagesOnly: true })) : null;
    const published = bool(formData, "published");

    const data = {
      type: reqEnum(formData, "type", CONTENT_TYPE_VALUES, "Type"),
      title,
      summary: optStr(formData, "summary", 500),
      body: reqStr(formData, "body", "Body", 50_000),
      language: reqEnum(formData, "language", LANGUAGE_VALUES, "Language"),
      eventDate: optDate(formData, "eventDate"),
      location: optStr(formData, "location", 200),
      published,
      ...(coverUrl ? { coverUrl } : {}),
    };

    if (contentId) {
      await db.content.update({ where: { id: contentId }, data });
    } else {
      const base = slugify(title) || "post";
      const slug = (await db.content.count({ where: { slug: base } })) ? `${base}-${Date.now().toString(36)}` : base;
      const created = await db.content.create({ data: { ...data, slug, authorId: admin.id } });
      savedId = created.id;
    }

    if (published && bool(formData, "notifyUsers")) {
      const users = await db.user.findMany({ where: { isSuspended: false }, select: { id: true } });
      const content = await db.content.findUniqueOrThrow({ where: { id: savedId! } });
      await notifyUsers(
        users.map((u) => u.id),
        { type: "SYSTEM", title: content.title, body: content.summary ?? "New awareness content is available.", link: `/awareness/${content.slug}` },
      );
    }
  } catch (error) {
    return toFormErrorState(error);
  }

  revalidatePath("/admin/content");
  revalidatePath("/awareness");
  if (!contentId) redirect(`/admin/content/${savedId}?saved=1`);
  return { success: "Content saved." };
}

export async function deleteContentAction(contentId: string) {
  await requireAdmin();
  await db.content.delete({ where: { id: contentId } });
  revalidatePath("/admin/content");
  redirect("/admin/content");
}

export async function broadcastNotificationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  let count = 0;
  try {
    const audience = reqEnum(formData, "audience", ["ALL", "DONORS", "AVAILABLE_DONORS", "BLOOD_GROUP", "DISTRICT"] as const, "Audience");
    const where: Prisma.UserWhereInput = { isSuspended: false };
    if (audience === "DONORS") where.isDonor = true;
    if (audience === "AVAILABLE_DONORS") Object.assign(where, { isDonor: true, isAvailable: true });
    if (audience === "BLOOD_GROUP") {
      where.isDonor = true;
      where.bloodGroup = reqEnum(formData, "bloodGroup", BLOOD_GROUP_VALUES, "Blood group") as BloodGroupValue;
    }
    if (audience === "DISTRICT") where.district = reqStr(formData, "district", "District", 50);

    const users = await db.user.findMany({ where, select: { id: true }, take: 50_000 });
    count = users.length;
    await notifyUsers(
      users.map((u) => u.id),
      {
        type: "SYSTEM",
        title: reqStr(formData, "title", "Title", 120),
        body: reqStr(formData, "body", "Message", 500),
        link: optStr(formData, "link", 200),
      },
      { sms: bool(formData, "sms") },
    );
  } catch (error) {
    return toFormErrorState(error);
  }
  return { success: `Notification sent to ${count} user(s).` };
}
