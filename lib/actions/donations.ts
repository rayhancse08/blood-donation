"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  type ActionState,
  FormError,
  getFile,
  optInt,
  optStr,
  reqDate,
  reqStr,
  toFormErrorState,
} from "@/lib/form";
import { notifyAdmins } from "@/lib/notify";
import { saveUpload } from "@/lib/storage";

export async function submitDonationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!user.isDonor) return { error: "Only donors can submit donation records. Enable the donor role in your profile first." };

  try {
    const donatedAt = reqDate(formData, "donatedAt", "Donation date");
    if (donatedAt.getTime() > Date.now() + 60 * 60 * 1000) throw new FormError("The donation date cannot be in the future.");
    if (donatedAt.getTime() < Date.now() - 365 * 24 * 60 * 60 * 1000) throw new FormError("Only donations from the last 12 months can be submitted.");

    const document = getFile(formData, "document");
    if (!document) throw new FormError("Please upload proof from the hospital or blood bank.");

    const requestId = optStr(formData, "requestId", 50);
    if (requestId) {
      const accepted = await db.requestResponse.count({ where: { requestId, donorId: user.id, status: "ACCEPTED" } });
      if (!accepted) throw new FormError("You can only link requests that you accepted.");
    }

    const facilityId = optStr(formData, "facilityId", 50);
    const facility = facilityId ? await db.facility.findUnique({ where: { id: facilityId }, select: { name: true } }) : null;

    const pending = await db.donation.count({ where: { donorId: user.id, status: "PENDING" } });
    if (pending >= 3) throw new FormError("You already have donations waiting for review. Please wait for them to be verified.");

    await db.donation.create({
      data: {
        donorId: user.id,
        requestId,
        facilityId: facility ? facilityId : null,
        donatedAt,
        place: optStr(formData, "place", 200) ?? facility?.name ?? reqStr(formData, "place", "Donation place", 200),
        receiverName: optStr(formData, "receiverName", 100),
        units: optInt(formData, "units", "Units", 1, 2) ?? 1,
        documentKey: await saveUpload(document, "donation-proofs", user.id),
      },
    });

    await notifyAdmins({
      type: "DONATION",
      title: "New donation proof submitted",
      body: `${user.name ?? "A donor"} submitted a donation for verification.`,
      link: "/admin/verifications",
    });
  } catch (error) {
    return toFormErrorState(error);
  }

  redirect("/donations?submitted=1");
}
