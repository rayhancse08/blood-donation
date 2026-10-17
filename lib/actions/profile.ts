"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isValidDistrict } from "@/lib/bd-locations";
import { BLOOD_GROUP_VALUES, GENDER_VALUES, ID_TYPE_VALUES, LOCATION_PRECISION_VALUES } from "@/lib/constants";
import { encrypt, hmac } from "@/lib/crypto";
import { db } from "@/lib/db";
import { isInCooldown } from "@/lib/donation-cycle";
import { alertRequestersForDonor } from "@/lib/donors";
import {
  type ActionState,
  bool,
  FormError,
  getFile,
  optCoordinates,
  optPhone,
  optStr,
  reqDate,
  reqEnum,
  reqPhone,
  reqStr,
  safeNext,
  toFormErrorState,
} from "@/lib/form";
import { ageFrom } from "@/lib/format";
import { applyPrecision } from "@/lib/geo";
import { validateIdNumber, verifyIdentityAutomatically } from "@/lib/identity";
import { notifyAdmins } from "@/lib/notify";
import { fileUrl, saveUpload } from "@/lib/storage";

const MIN_DONOR_AGE = 18;

export async function saveProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser({ allowIncompleteProfile: true });
  let redirectTo: string | null = null;

  try {
    const name = reqStr(formData, "name", "Name", 100);
    const dateOfBirth = reqDate(formData, "dateOfBirth", "Date of birth");
    const now = new Date();
    const age = ageFrom(dateOfBirth, now);
    if (age == null || age < 1 || age > 120) throw new FormError("Please enter a valid date of birth.");

    const gender = reqEnum(formData, "gender", GENDER_VALUES, "Gender");
    const bloodGroup = reqEnum(formData, "bloodGroup", BLOOD_GROUP_VALUES, "Blood group");
    const division = reqStr(formData, "division", "Division", 50);
    const district = reqStr(formData, "district", "District", 50);
    if (!isValidDistrict(division, district)) throw new FormError("Please select a valid district for the division.");

    const contactPhone = reqPhone(formData, "contactPhone", "Contact phone");
    const emergencyContactPhone = optPhone(formData, "emergencyContactPhone", "Emergency contact phone");
    const becomeDonor = bool(formData, "becomeDonor");
    if (becomeDonor && age < MIN_DONOR_AGE) throw new FormError(`Donors must be at least ${MIN_DONOR_AGE} years old.`);

    const photo = getFile(formData, "photo");
    const photoUrl = photo ? fileUrl(await saveUpload(photo, "avatars", user.id, { imagesOnly: true })) : null;
    const coords = optCoordinates(formData);

    await db.user.update({
      where: { id: user.id },
      data: {
        name,
        dateOfBirth,
        gender,
        bloodGroup,
        division,
        district,
        upazila: optStr(formData, "upazila", 100),
        thana: optStr(formData, "thana", 100),
        addressLine: optStr(formData, "addressLine", 300),
        contactPhone,
        emergencyContactName: optStr(formData, "emergencyContactName", 100),
        emergencyContactPhone,
        profileCompleted: true,
        ...(photoUrl ? { photoUrl } : {}),
        ...(becomeDonor ? { isDonor: true } : {}),
        ...(coords
          ? { ...applyPrecision(coords.latitude, coords.longitude, user.locationPrecision), locationUpdatedAt: now }
          : {}),
      },
    });

    redirectTo = safeNext(formData.get("redirectTo"));
  } catch (error) {
    return toFormErrorState(error);
  }

  revalidatePath("/", "layout");
  if (redirectTo) redirect(redirectTo);
  return { success: "Your profile has been saved." };
}

export async function updateRolesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  let isReceiver = bool(formData, "isReceiver");
  const isDonor = bool(formData, "isDonor");
  if (!isReceiver && !isDonor) isReceiver = true;

  if (isDonor && !user.isDonor) {
    const age = ageFrom(user.dateOfBirth, new Date());
    if (age != null && age < MIN_DONOR_AGE) return { error: `Donors must be at least ${MIN_DONOR_AGE} years old.` };
  }

  const activeMode = user.activeMode === "DONOR" && !isDonor ? "RECEIVER" : user.activeMode === "RECEIVER" && !isReceiver ? "DONOR" : user.activeMode;

  await db.user.update({
    where: { id: user.id },
    data: { isReceiver, isDonor, activeMode, ...(isDonor ? {} : { isAvailable: false }) },
  });
  revalidatePath("/", "layout");
  return { success: "Your roles have been updated." };
}

export async function switchModeAction(mode: "RECEIVER" | "DONOR") {
  const user = await requireUser();
  if (mode === "DONOR" && !user.isDonor) {
    await db.user.update({ where: { id: user.id }, data: { isDonor: true, activeMode: "DONOR" } });
  } else if (mode === "RECEIVER" && !user.isReceiver) {
    await db.user.update({ where: { id: user.id }, data: { isReceiver: true, activeMode: "RECEIVER" } });
  } else {
    await db.user.update({ where: { id: user.id }, data: { activeMode: mode } });
  }
  revalidatePath("/", "layout");
}

export async function setAvailabilityAction(available: boolean) {
  const user = await requireUser();
  if (!user.isDonor) return;
  if (available && isInCooldown(user, new Date())) return;
  await db.user.update({ where: { id: user.id }, data: { isAvailable: available } });
  revalidatePath("/", "layout");
}

export async function updateLocationPrivacyAction(formData: FormData) {
  const user = await requireUser();
  const precision = reqEnum(formData, "locationPrecision", LOCATION_PRECISION_VALUES, "Location precision");
  const coords =
    precision === "APPROXIMATE" && user.latitude != null && user.longitude != null
      ? applyPrecision(user.latitude, user.longitude, "APPROXIMATE")
      : {};
  await db.user.update({ where: { id: user.id }, data: { locationPrecision: precision, ...coords } });
  revalidatePath("/profile");
}

export async function clearLocationAction() {
  const user = await requireUser();
  await db.user.update({
    where: { id: user.id },
    data: { latitude: null, longitude: null, locationUpdatedAt: null },
  });
  revalidatePath("/", "layout");
}

export async function offerEmergencyDonationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!user.isDonor || !user.bloodGroup) return { error: "Only registered donors with a blood group can use this." };
  if (isInCooldown(user, new Date())) return { error: "You are in your 3-month rest period after your last donation." };

  const coords = optCoordinates(formData);
  const location = coords ? applyPrecision(coords.latitude, coords.longitude, user.locationPrecision) : null;

  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      isAvailable: true,
      activeMode: "DONOR",
      ...(location ? { ...location, locationUpdatedAt: new Date() } : {}),
    },
  });

  const count = await alertRequestersForDonor({
    id: updated.id,
    name: updated.name,
    bloodGroup: user.bloodGroup,
    latitude: updated.latitude,
    longitude: updated.longitude,
    district: updated.district,
  });

  revalidatePath("/", "layout");
  return {
    success:
      count > 0
        ? `You are now available. We alerted ${count} emergency request(s) near you.`
        : "You are now available and visible on the map. There are no matching emergency requests near you right now.",
  };
}

export async function submitIdentityAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (user.idVerificationStatus === "VERIFIED") return { error: "Your identity is already verified." };

  try {
    const idType = reqEnum(formData, "idType", ID_TYPE_VALUES, "ID type");
    const idNumber = validateIdNumber(idType, reqStr(formData, "idNumber", "ID number", 30));
    if (!idNumber) {
      throw new FormError(
        idType === "NID" ? "NID numbers have 10, 13 or 17 digits." : "Birth registration numbers have 17 digits.",
      );
    }

    const idNumberHash = hmac(`${idType}:${idNumber}`);
    const existing = await db.user.findFirst({ where: { idNumberHash, id: { not: user.id } }, select: { id: true } });
    if (existing) throw new FormError("This ID number is already linked to another account.");

    const document = getFile(formData, "document");
    const idDocumentKey = document ? await saveUpload(document, "identity", user.id) : user.idDocumentKey;

    const automatic = await verifyIdentityAutomatically({
      idType,
      idNumber,
      name: user.name,
      dateOfBirth: user.dateOfBirth,
    });

    await db.user.update({
      where: { id: user.id },
      data: {
        idType,
        idNumberEncrypted: encrypt(idNumber),
        idNumberHash,
        idDocumentKey,
        idVerificationStatus: automatic ?? "PENDING",
        idVerifiedAt: automatic === "VERIFIED" ? new Date() : null,
        idReviewNote: null,
      },
    });

    if (!automatic) {
      await notifyAdmins({
        type: "SYSTEM",
        title: "Identity verification pending",
        body: `${user.name ?? "A user"} submitted ${idType === "NID" ? "an NID" : "a birth registration"} for review.`,
        link: "/admin/verifications",
      });
    }
  } catch (error) {
    return toFormErrorState(error);
  }

  revalidatePath("/profile");
  return { success: "Your identity details were submitted securely." };
}
