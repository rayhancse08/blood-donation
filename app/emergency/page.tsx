import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { GeoInputs } from "@/components/GeoInputs";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, BloodGroupSelect, buttonClass, Card, Field, inputClass, PageContainer } from "@/components/ui";
import { offerEmergencyDonationAction } from "@/lib/actions/profile";
import { createEmergencyRequestAction } from "@/lib/actions/requests";
import { getCurrentUser } from "@/lib/auth";
import { NATIONAL_EMERGENCY_NUMBER } from "@/lib/constants";
import { db } from "@/lib/db";
import { requestTime } from "@/lib/request-time";
import { isInCooldown } from "@/lib/donation-cycle";
import { distanceBetween, formatDistance, userOrigin } from "@/lib/geo";

export const metadata: Metadata = { title: "Emergency" };

export default async function EmergencyPage() {
  const user = await getCurrentUser();
  const now = await requestTime();
  const origin = userOrigin(user);

  const facilities = await db.facility.findMany({
    where: {
      type: { in: ["AMBULANCE", "BLOOD_BANK"] },
      isActive: true,
      phone: { not: null },
      ...(user?.district ? { district: user.district } : {}),
    },
    select: { id: true, name: true, type: true, phone: true, district: true, is24Hours: true, latitude: true, longitude: true },
    take: 50,
  });
  const sorted = facilities
    .map((f) => ({ ...f, distanceKm: distanceBetween(origin, f.latitude, f.longitude) }))
    .sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
  const ambulances = sorted.filter((f) => f.type === "AMBULANCE").slice(0, 6);
  const bloodBanks = sorted.filter((f) => f.type === "BLOOD_BANK").slice(0, 4);

  return (
    <PageContainer className="max-w-5xl space-y-6">
      <div className="rounded-2xl bg-red-600 p-6 text-white shadow-lg">
        <h1 className="text-3xl font-extrabold">Emergency</h1>
        <p className="mt-1 text-red-50">
          If someone&apos;s life is in danger, call {NATIONAL_EMERGENCY_NUMBER} or an ambulance first. Then use the button below to alert
          blood donors near you.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href={`tel:${NATIONAL_EMERGENCY_NUMBER}`} className="rounded-lg bg-white px-5 py-3 font-bold text-red-700 shadow">
            Call {NATIONAL_EMERGENCY_NUMBER}
          </a>
          {ambulances[0]?.phone && (
            <a href={`tel:${ambulances[0].phone}`} className="rounded-lg border border-white/60 px-5 py-3 font-semibold hover:bg-white/10">
              Call nearest ambulance
            </a>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="I need blood now">
          {user ? (
            <ActionForm action={createEmergencyRequestAction}>
              <p className="text-sm text-gray-600">
                One tap sends an urgent alert, by push notification and SMS, to every available compatible donor within 25 km.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Blood group" required>
                  <BloodGroupSelect defaultValue={user.bloodGroup} required />
                </Field>
                <Field label="Units">
                  <input name="units" type="number" min={1} max={10} defaultValue={1} className={inputClass} />
                </Field>
              </div>
              <Field label="Hospital (optional)">
                <input name="hospitalName" maxLength={150} placeholder="Where should donors come?" className={inputClass} />
              </Field>
              <Field label="Contact phone">
                <input name="contactPhone" type="tel" defaultValue={user.contactPhone ?? user.phone ?? ""} className={inputClass} />
              </Field>
              <Field label="Your location">
                <GeoInputs auto defaultLat={user.latitude} defaultLng={user.longitude} label="Refresh location" />
              </Field>
              <SubmitButton className="w-full rounded-xl bg-red-600 py-4 text-lg font-extrabold text-white shadow-lg hover:bg-red-700 disabled:opacity-60" pendingText="Alerting donors…">
                SEND EMERGENCY ALERT
              </SubmitButton>
            </ActionForm>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Sign in to send an emergency alert to donors near you. It takes less than a minute.</p>
              <Link href="/login?next=/emergency" className={buttonClass.primary}>
                Sign in
              </Link>
            </div>
          )}
        </Card>

        <Card title="I can give blood now">
          {!user ? (
            <p className="text-sm text-gray-600">Sign in as a donor to tell people with emergency requests that you can donate immediately.</p>
          ) : !user.isDonor ? (
            <p className="text-sm text-gray-600">
              Only donors can use this. <Link href="/profile#roles" className="text-red-600 underline">Become a donor</Link>.
            </p>
          ) : isInCooldown(user, now) ? (
            <p className="text-sm text-gray-600">You are in your 3-month rest period after your last donation. Thank you!</p>
          ) : (
            <ActionForm action={offerEmergencyDonationAction}>
              <p className="text-sm text-gray-600">
                We will make you available on the map and alert people with open emergency requests that match your blood group near you.
              </p>
              <Field label="Your location">
                <GeoInputs defaultLat={user.latitude} defaultLng={user.longitude} label="Update location" />
              </Field>
              <SubmitButton className={`${buttonClass.success} w-full py-3`}>I&apos;m ready to donate now</SubmitButton>
            </ActionForm>
          )}
          <Link href="/requests?emergency=1" className="mt-4 block text-sm font-medium text-red-600 hover:underline">
            See all emergency requests →
          </Link>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Ambulance services" actions={<Link href="/directory?type=AMBULANCE" className="text-sm text-red-600 hover:underline">All</Link>}>
          <FacilityCallList items={ambulances} empty="No ambulance services listed in your area yet." />
        </Card>
        <Card title="Blood banks" actions={<Link href="/directory?type=BLOOD_BANK" className="text-sm text-red-600 hover:underline">All</Link>}>
          <FacilityCallList items={bloodBanks} empty="No blood banks listed in your area yet." />
        </Card>
      </div>
    </PageContainer>
  );
}

function FacilityCallList({
  items,
  empty,
}: {
  items: { id: string; name: string; phone: string | null; district: string | null; is24Hours: boolean; distanceKm: number | null }[];
  empty: string;
}) {
  if (items.length === 0) return <p className="text-sm text-gray-600">{empty}</p>;
  return (
    <ul className="divide-y divide-gray-100">
      {items.map((f) => (
        <li key={f.id} className="flex items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <Link href={`/directory/${f.id}`} className="font-medium hover:underline">
              {f.name}
            </Link>
            <p className="text-xs text-gray-500">
              {f.district}
              {f.distanceKm != null && ` · ${formatDistance(f.distanceKm)}`}
              {f.is24Hours && " · "}
              {f.is24Hours && <Badge tone="green">24h</Badge>}
            </p>
          </div>
          {f.phone && (
            <a href={`tel:${f.phone}`} className={buttonClass.success}>
              Call
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
