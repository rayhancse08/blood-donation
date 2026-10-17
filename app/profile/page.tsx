import type { Metadata } from "next";
import { ActionForm } from "@/components/ActionForm";
import { ProfileFields } from "@/components/ProfileFields";
import { SubmitButton } from "@/components/SubmitButton";
import { Avatar, Badge, buttonClass, Card, Field, inputClass, PageContainer, PageHeader, SelectOptions } from "@/components/ui";
import { logoutAction } from "@/lib/actions/auth";
import {
  clearLocationAction,
  saveProfileAction,
  setAvailabilityAction,
  submitIdentityAction,
  updateLocationPrivacyAction,
  updateRolesAction,
} from "@/lib/actions/profile";
import { unblockUserAction } from "@/lib/actions/safety";
import { requireUser } from "@/lib/auth";
import { ID_TYPES, LOCATION_PRECISIONS, labelOf, VERIFICATION_STATUS_TONE } from "@/lib/constants";
import { decrypt, maskIdentifier } from "@/lib/crypto";
import { db } from "@/lib/db";
import { requestTime } from "@/lib/request-time";
import { isInCooldown } from "@/lib/donation-cycle";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Profile & settings" };

function maskStoredId(encrypted: string) {
  try {
    return maskIdentifier(decrypt(encrypted));
  } catch {
    return "****";
  }
}

export default async function ProfilePage() {
  const user = await requireUser();
  const now = await requestTime();
  const blocked = await db.block.findMany({
    where: { blockerId: user.id },
    include: { blocked: { select: { id: true, name: true, photoUrl: true } } },
  });
  const maskedId = user.idNumberEncrypted ? maskStoredId(user.idNumberEncrypted) : null;

  return (
    <PageContainer className="max-w-4xl space-y-6">
      <PageHeader title="Profile & settings" description={user.phone ?? user.email ?? undefined} />

      <Card title="Personal information">
        <ActionForm action={saveProfileAction} className="space-y-6">
          <ProfileFields user={user} />
          <SubmitButton pendingText="Saving…">Save profile</SubmitButton>
        </ActionForm>
      </Card>

      <div id="roles">
        <Card title="Roles">
          <p className="mb-4 text-sm text-gray-600">
            Every account starts as a receiver. You can also be a donor, and switch between the two from the header or dashboard.
          </p>
          <ActionForm action={updateRolesAction}>
            <label className="flex items-start gap-3">
              <input type="checkbox" name="isReceiver" defaultChecked={user.isReceiver} className="mt-1" />
              <span>
                <span className="font-medium">Receiver</span>
                <span className="block text-sm text-gray-600">Post blood requests and find donors.</span>
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input type="checkbox" name="isDonor" defaultChecked={user.isDonor} className="mt-1" />
              <span>
                <span className="font-medium">Donor</span>
                <span className="block text-sm text-gray-600">Appear on the map when available and receive matching requests (18+).</span>
              </span>
            </label>
            <SubmitButton>Update roles</SubmitButton>
          </ActionForm>
        </Card>
      </div>

      {user.isDonor && (
        <Card title="Donor availability">
          {isInCooldown(user, now) ? (
            <p className="text-sm text-gray-700">
              You are in your 3-month rest period and hidden from the map until <strong>{formatDate(user.hiddenUntil)}</strong>.
            </p>
          ) : (
            <form action={setAvailabilityAction.bind(null, !user.isAvailable)} className="flex flex-wrap items-center gap-3 sm:gap-4">
              <Badge tone={user.isAvailable ? "green" : "gray"}>{user.isAvailable ? "Available" : "Not available"}</Badge>
              <button type="submit" className={buttonClass.secondary}>
                {user.isAvailable ? "Switch off" : "Switch on"}
              </button>
            </form>
          )}
        </Card>
      )}

      <Card title="Location privacy">
        <form action={updateLocationPrivacyAction} className="space-y-4">
          <Field label="How precisely should your location be stored?" hint="Approximate location rounds your position to about 1 km so your exact home cannot be identified.">
            <select name="locationPrecision" defaultValue={user.locationPrecision} className={inputClass}>
              <SelectOptions options={LOCATION_PRECISIONS} />
            </select>
          </Field>
          <div className="flex flex-wrap gap-2">
            <SubmitButton>Save privacy setting</SubmitButton>
          </div>
        </form>
        {user.latitude != null && (
          <form action={clearLocationAction} className="mt-4 border-t border-gray-100 pt-4">
            <p className="mb-2 text-sm text-gray-600">Location last updated {formatDateTime(user.locationUpdatedAt)}.</p>
            <button type="submit" className={buttonClass.danger}>
              Remove my location
            </button>
          </form>
        )}
      </Card>

      <Card
        title="Identity verification"
        actions={<Badge tone={VERIFICATION_STATUS_TONE[user.idVerificationStatus]}>{user.idVerificationStatus.toLowerCase()}</Badge>}
      >
        <p className="mb-4 text-sm text-gray-600">
          Verify your National ID or birth registration to get a verified badge. Your number is encrypted and only visible to
          verification staff.
        </p>
        {user.idVerificationStatus === "VERIFIED" ? (
          <p className="text-sm">
            {labelOf(ID_TYPES, user.idType)}: <strong>{maskedId}</strong> · verified on {formatDate(user.idVerifiedAt)}
          </p>
        ) : (
          <ActionForm action={submitIdentityAction}>
            {user.idVerificationStatus === "PENDING" && (
              <p className="text-sm text-yellow-800">Your submission ({maskedId}) is under review. You can update it below.</p>
            )}
            {user.idVerificationStatus === "REJECTED" && user.idReviewNote && (
              <p className="text-sm text-red-700">Previous submission rejected: {user.idReviewNote}</p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="ID type" required>
                <select name="idType" defaultValue={user.idType ?? "NID"} className={inputClass}>
                  <SelectOptions options={ID_TYPES} />
                </select>
              </Field>
              <Field label="ID number" required>
                <input name="idNumber" inputMode="numeric" autoComplete="off" required maxLength={30} className={inputClass} />
              </Field>
            </div>
            <Field label="Photo or scan of the document" hint="Optional, speeds up manual review. JPG, PNG or PDF, max 5 MB.">
              <input type="file" name="document" accept="image/jpeg,image/png,image/webp,application/pdf" className="w-full max-w-full text-sm" />
            </Field>
            <SubmitButton>Submit for verification</SubmitButton>
          </ActionForm>
        )}
      </Card>

      <Card title="Blocked users">
        {blocked.length === 0 ? (
          <p className="text-sm text-gray-600">You have not blocked anyone. You can block users from their profile card or chat.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {blocked.map((b) => (
              <li key={b.blockedId} className="flex items-center gap-3 py-2">
                <Avatar name={b.blocked.name} src={b.blocked.photoUrl} size={32} />
                <span className="flex-1 text-sm">{b.blocked.name ?? "User"}</span>
                <form action={unblockUserAction.bind(null, b.blockedId)}>
                  <button type="submit" className={buttonClass.small}>
                    Unblock
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <form action={logoutAction}>
        <button type="submit" className={buttonClass.danger}>
          Sign out
        </button>
      </form>
    </PageContainer>
  );
}
