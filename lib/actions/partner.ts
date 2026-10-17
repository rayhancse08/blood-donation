"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Facility } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth";
import { isValidDistrict } from "@/lib/bd-locations";
import { FACILITY_TYPE_VALUES } from "@/lib/constants";
import { db } from "@/lib/db";
import {
  type ActionState,
  bool,
  FormError,
  getFile,
  optCoordinates,
  optDate,
  optInt,
  optStr,
  reqInt,
  reqEnum,
  reqNumber,
  reqStr,
  toFormErrorState,
} from "@/lib/form";
import { toPoisha } from "@/lib/money";
import { notifyAdmins } from "@/lib/notify";
import { saveUpload } from "@/lib/storage";

async function requireOwnedFacility(facilityId: string): Promise<Facility> {
  const user = await requireUser();
  const facility = await db.facility.findUnique({ where: { id: facilityId } });
  if (!facility || (facility.ownerId !== user.id && user.role !== "ADMIN")) redirect("/partner");
  return facility;
}

export async function registerPartnerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  let facilityId = "";

  try {
    const division = reqStr(formData, "division", "Division", 50);
    const district = reqStr(formData, "district", "District", 50);
    if (!isValidDistrict(division, district)) throw new FormError("Please select a valid district.");

    const licenseDoc = getFile(formData, "licenseDoc");
    if (!licenseDoc) throw new FormError("Please upload your trade / drug licence document.");
    if (!bool(formData, "agree")) throw new FormError("You must agree to the partner discount terms.");

    const coords = optCoordinates(formData);
    const facility = await db.facility.create({
      data: {
        type: reqEnum(formData, "type", FACILITY_TYPE_VALUES, "Provider type"),
        name: reqStr(formData, "name", "Name", 150),
        description: optStr(formData, "description", 1000),
        phone: reqStr(formData, "phone", "Phone", 30),
        email: optStr(formData, "email", 150),
        website: optStr(formData, "website", 200),
        division,
        district,
        upazila: optStr(formData, "upazila", 100),
        thana: optStr(formData, "thana", 100),
        address: reqStr(formData, "address", "Address", 300),
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        openingHours: optStr(formData, "openingHours", 100),
        is24Hours: bool(formData, "is24Hours"),
        services: (optStr(formData, "services", 500) ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        ownerId: user.id,
        partnerStatus: "PENDING",
        isActive: false,
        discountPercent: reqInt(formData, "discountPercent", "Discount", 0, 50),
        discountTerms: optStr(formData, "discountTerms", 1000),
        licenseNumber: reqStr(formData, "licenseNumber", "Licence number", 60),
        licenseDocKey: await saveUpload(licenseDoc, "licenses", user.id),
      },
    });
    facilityId = facility.id;

    await notifyAdmins({
      type: "PARTNER",
      title: "New partner application",
      body: `${facility.name} applied to become a partner.`,
      link: "/admin/facilities?tab=pending",
    });
  } catch (error) {
    return toFormErrorState(error);
  }

  redirect(`/partner/${facilityId}?applied=1`);
}

export async function updateFacilityDetailsAction(facilityId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireOwnedFacility(facilityId);
  try {
    await db.facility.update({
      where: { id: facilityId },
      data: {
        description: optStr(formData, "description", 1000),
        phone: reqStr(formData, "phone", "Phone", 30),
        email: optStr(formData, "email", 150),
        website: optStr(formData, "website", 200),
        address: reqStr(formData, "address", "Address", 300),
        openingHours: optStr(formData, "openingHours", 100),
        is24Hours: bool(formData, "is24Hours"),
        discountPercent: reqInt(formData, "discountPercent", "Discount", 0, 50),
        discountTerms: optStr(formData, "discountTerms", 1000),
        services: (optStr(formData, "services", 500) ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      },
    });
  } catch (error) {
    return toFormErrorState(error);
  }
  revalidatePath(`/partner/${facilityId}`);
  return { success: "Details updated." };
}

export async function upsertStockAction(facilityId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const facility = await requireOwnedFacility(facilityId);
  if (facility.type !== "PHARMACY") return { error: "Only pharmacies can list medicines." };

  try {
    let medicineId = optStr(formData, "medicineId", 50);
    if (!medicineId) {
      const name = reqStr(formData, "name", "Medicine name", 120);
      const strength = optStr(formData, "strength", 50);
      const existing = await db.medicine.findFirst({
        where: { name: { equals: name, mode: "insensitive" }, strength: strength ?? undefined },
      });
      const medicine =
        existing ??
        (await db.medicine.create({
          data: {
            name,
            strength,
            genericName: optStr(formData, "genericName", 120),
            manufacturer: optStr(formData, "manufacturer", 120),
            form: optStr(formData, "form", 50),
            requiresPrescription: bool(formData, "requiresPrescription"),
          },
        }));
      medicineId = medicine.id;
    }

    const price = toPoisha(reqNumber(formData, "price", "Price", 0.01, 1_000_000));
    const quantity = reqInt(formData, "quantity", "Quantity", 0, 1_000_000);
    await db.pharmacyStock.upsert({
      where: { pharmacyId_medicineId: { pharmacyId: facilityId, medicineId } },
      create: { pharmacyId: facilityId, medicineId, price, quantity },
      update: { price, quantity },
    });
  } catch (error) {
    return toFormErrorState(error);
  }

  revalidatePath(`/partner/${facilityId}`);
  return { success: "Stock updated." };
}

export async function removeStockAction(facilityId: string, stockId: string) {
  await requireOwnedFacility(facilityId);
  await db.pharmacyStock.deleteMany({ where: { id: stockId, pharmacyId: facilityId } });
  revalidatePath(`/partner/${facilityId}`);
}

export async function createOfferAction(facilityId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const facility = await requireOwnedFacility(facilityId);
  if (facility.partnerStatus !== "APPROVED") return { error: "Offers can be created once your partnership is approved." };
  try {
    await db.partnerOffer.create({
      data: {
        facilityId,
        title: reqStr(formData, "title", "Title", 120),
        description: reqStr(formData, "description", "Description", 500),
        code: optStr(formData, "code", 40),
        minDonations: optInt(formData, "minDonations", "Minimum donations", 0, 100) ?? 1,
        validUntil: optDate(formData, "validUntil"),
      },
    });
  } catch (error) {
    return toFormErrorState(error);
  }
  revalidatePath(`/partner/${facilityId}`);
  return { success: "Offer published to donors." };
}

export async function toggleOfferAction(facilityId: string, offerId: string) {
  await requireOwnedFacility(facilityId);
  const offer = await db.partnerOffer.findFirst({ where: { id: offerId, facilityId } });
  if (!offer) return;
  await db.partnerOffer.update({ where: { id: offerId }, data: { isActive: !offer.isActive } });
  revalidatePath(`/partner/${facilityId}`);
}
