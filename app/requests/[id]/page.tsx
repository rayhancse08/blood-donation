import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportButton } from "@/components/ReportButton";
import {
  Alert,
  Avatar,
  Badge,
  BloodGroupBadge,
  buttonClass,
  Card,
  KeyValue,
  PageContainer,
} from "@/components/ui";
import { startConversationAction } from "@/lib/actions/messages";
import { resendAlertsAction, respondToRequestAction, updateRequestStatusAction } from "@/lib/actions/requests";
import { getCurrentUser } from "@/lib/auth";
import { canDonateTo, compatibleDonorGroups } from "@/lib/blood";
import { bloodGroupLabel, labelOf, REQUEST_STATUSES, REQUEST_STATUS_TONE, URGENCIES, URGENCY_TONE, type BloodGroupValue } from "@/lib/constants";
import { db } from "@/lib/db";
import { requestTime } from "@/lib/request-time";
import { isInCooldown } from "@/lib/donation-cycle";
import { formatDateTime, one, timeAgo } from "@/lib/format";
import { distanceBetween, formatDistance, mapsLink, userOrigin } from "@/lib/geo";

export const metadata: Metadata = { title: "Blood request" };

export default async function RequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();
  const now = await requestTime();

  const request = await db.bloodRequest.findUnique({
    where: { id },
    include: {
      requester: { select: { id: true, name: true, photoUrl: true, idVerificationStatus: true } },
      responses: {
        orderBy: { createdAt: "asc" },
        include: {
          donor: {
            select: {
              id: true,
              name: true,
              photoUrl: true,
              bloodGroup: true,
              phone: true,
              contactPhone: true,
              idVerificationStatus: true,
              latitude: true,
              longitude: true,
            },
          },
        },
      },
    },
  });
  if (!request) notFound();

  const isOwner = user?.id === request.requesterId;
  const isAdmin = user?.role === "ADMIN";
  const myResponse = request.responses.find((r) => r.donorId === user?.id);
  const accepted = request.responses.filter((r) => r.status === "ACCEPTED");
  const active = request.status === "OPEN" || request.status === "ACCEPTED";
  const recipient = request.bloodGroup as BloodGroupValue;

  const compatible = !!user?.bloodGroup && canDonateTo(user.bloodGroup as BloodGroupValue, recipient);
  const cooldown = !!user && isInCooldown(user, now);
  const canRespond = !!user && !isOwner && user.isDonor && compatible && !cooldown && active;
  const showRequesterContact = isOwner || isAdmin || myResponse?.status === "ACCEPTED";
  const distance = distanceBetween(userOrigin(user), request.latitude, request.longitude);

  return (
    <PageContainer className="max-w-4xl space-y-6">
      {one(query.created) === "1" && (
        <Alert tone="success">
          Your request is live. We are alerting compatible donors nearby{request.isEmergency ? " by notification and SMS" : ""}. You
          will be notified when someone accepts.
        </Alert>
      )}

      <div className={`rounded-2xl border bg-white p-6 shadow-sm ${request.isEmergency ? "border-red-300" : "border-gray-200"}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <BloodGroupBadge group={request.bloodGroup} size="lg" />
          <div className="flex-1">
            <div className="flex flex-wrap gap-1">
              {request.isEmergency && <Badge tone="red">Emergency</Badge>}
              <Badge tone={URGENCY_TONE[request.urgency]}>{labelOf(URGENCIES, request.urgency)}</Badge>
              <Badge tone={REQUEST_STATUS_TONE[request.status]}>{labelOf(REQUEST_STATUSES, request.status)}</Badge>
            </div>
            <h1 className="mt-2 text-2xl font-bold">
              {request.units} unit(s) of {bloodGroupLabel(request.bloodGroup)} needed
            </h1>
            <p className="text-gray-600">
              at {request.hospitalName} · posted {timeAgo(request.createdAt, now)}
            </p>
          </div>
          {user && !isOwner && <ReportButton requestId={request.id} reportedUserId={request.requesterId} label="Report request" />}
        </div>

        <dl className="mt-6 grid gap-x-8 sm:grid-cols-2">
          <KeyValue label="Needed by">{formatDateTime(request.neededBy)}</KeyValue>
          <KeyValue label="Location">{[request.thana, request.upazila, request.district, request.division].filter(Boolean).join(", ") || "Shared via GPS"}</KeyValue>
          {request.patientName && <KeyValue label="Patient">{request.patientName}</KeyValue>}
          {request.address && <KeyValue label="Ward / address">{request.address}</KeyValue>}
          {distance != null && <KeyValue label="Distance from you">{formatDistance(distance)}</KeyValue>}
          <KeyValue label="Compatible donor groups">{compatibleDonorGroups(recipient).map(bloodGroupLabel).join(", ")}</KeyValue>
          <KeyValue label="Requested by">
            {request.requester.name ?? "User"}
            {request.requester.idVerificationStatus === "VERIFIED" && " (verified)"}
          </KeyValue>
          <KeyValue label="Contact">
            {showRequesterContact ? (
              <a href={`tel:${request.contactPhone}`} className="text-red-600 hover:underline">
                {request.contactPhone}
              </a>
            ) : (
              <span className="text-gray-500">Visible after you accept</span>
            )}
          </KeyValue>
        </dl>

        {request.notes && <p className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{request.notes}</p>}

        {request.latitude != null && request.longitude != null && (
          <a href={mapsLink(request.latitude, request.longitude)} target="_blank" rel="noopener noreferrer" className={`${buttonClass.secondary} mt-4`}>
            Open in Google Maps
          </a>
        )}
      </div>

      {!user && active && (
        <Card>
          <p className="text-sm text-gray-700">Are you a donor? Sign in to accept this request and see the contact details.</p>
          <Link href={`/login?next=/requests/${request.id}`} className={`${buttonClass.primary} mt-3`}>
            Sign in to help
          </Link>
        </Card>
      )}

      {user && !isOwner && active && (
        <Card title="Can you donate?">
          {canRespond ? (
            <div className="space-y-3">
              {myResponse?.status === "ACCEPTED" ? (
                <Alert tone="success">
                  You accepted this request. Please call the requester and go to the hospital. After donating, submit your proof to
                  record it.
                </Alert>
              ) : myResponse?.status === "DECLINED" ? (
                <p className="text-sm text-gray-600">You declined this request. You can still change your mind.</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {myResponse?.status !== "ACCEPTED" && (
                  <form action={respondToRequestAction.bind(null, request.id, "ACCEPTED")}>
                    <button type="submit" className={buttonClass.success}>
                      Accept - I can donate
                    </button>
                  </form>
                )}
                {myResponse?.status !== "DECLINED" && (
                  <form action={respondToRequestAction.bind(null, request.id, "DECLINED")}>
                    <button type="submit" className={buttonClass.secondary}>
                      {myResponse?.status === "ACCEPTED" ? "I can no longer donate" : "Decline"}
                    </button>
                  </form>
                )}
                {myResponse?.status === "ACCEPTED" && (
                  <>
                    <a href={`tel:${request.contactPhone}`} className={buttonClass.primary}>
                      Call requester
                    </a>
                    <form action={startConversationAction}>
                      <input type="hidden" name="otherUserId" value={request.requesterId} />
                      <input type="hidden" name="requestId" value={request.id} />
                      <button type="submit" className={buttonClass.secondary}>
                        Message
                      </button>
                    </form>
                    <Link href={`/donations/new?requestId=${request.id}`} className={buttonClass.secondary}>
                      Submit donation proof
                    </Link>
                  </>
                )}
              </div>
            </div>
          ) : !user.isDonor ? (
            <p className="text-sm text-gray-600">
              Only donors can accept requests. <Link href="/profile#roles" className="text-red-600 underline">Become a donor</Link>.
            </p>
          ) : !user.bloodGroup ? (
            <p className="text-sm text-gray-600">Add your blood group in your profile to respond.</p>
          ) : !compatible ? (
            <p className="text-sm text-gray-600">
              Your blood group ({bloodGroupLabel(user.bloodGroup)}) is not compatible with {bloodGroupLabel(request.bloodGroup)}. You
              can still share this request with others.
            </p>
          ) : (
            <p className="text-sm text-gray-600">You are in your 3-month rest period after your last donation. Thank you for donating!</p>
          )}
        </Card>
      )}

      {(isOwner || isAdmin) && (
        <Card
          title={`Donors who accepted (${accepted.length})`}
          actions={
            active && (
              <div className="flex flex-wrap gap-2">
                {request.status === "OPEN" && (
                  <form action={resendAlertsAction.bind(null, request.id)}>
                    <button type="submit" className={buttonClass.small}>
                      Alert donors again
                    </button>
                  </form>
                )}
                <form action={updateRequestStatusAction.bind(null, request.id, "FULFILLED")}>
                  <button type="submit" className={buttonClass.small}>
                    Mark fulfilled
                  </button>
                </form>
                <form action={updateRequestStatusAction.bind(null, request.id, "CANCELLED")}>
                  <button type="submit" className={buttonClass.small}>
                    Cancel request
                  </button>
                </form>
              </div>
            )
          }
        >
          <p className="mb-3 text-sm text-gray-600">{request.alertedCount} compatible donor(s) were alerted.</p>
          {accepted.length === 0 ? (
            <p className="text-sm text-gray-600">No donor has accepted yet. You can also look for donors on the <Link href={`/map?bloodGroup=${request.bloodGroup}&compatible=1`} className="text-red-600 underline">map</Link>.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {accepted.map(({ donor }) => {
                const phone = donor.contactPhone ?? donor.phone;
                const donorDistance = distanceBetween(
                  request.latitude != null && request.longitude != null ? { lat: request.latitude, lng: request.longitude } : null,
                  donor.latitude,
                  donor.longitude,
                );
                return (
                  <li key={donor.id} className="flex flex-wrap items-center gap-3 py-3">
                    <Avatar name={donor.name} src={donor.photoUrl} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {donor.name ?? "Donor"} <Badge tone="red">{bloodGroupLabel(donor.bloodGroup)}</Badge>{" "}
                        {donor.idVerificationStatus === "VERIFIED" && <Badge tone="green">Verified</Badge>}
                      </p>
                      <p className="text-xs text-gray-500">
                        {phone}
                        {donorDistance != null && ` · ${formatDistance(donorDistance)} from hospital`}
                      </p>
                    </div>
                    {phone && (
                      <a href={`tel:${phone}`} className={buttonClass.success}>
                        Call
                      </a>
                    )}
                    <form action={startConversationAction}>
                      <input type="hidden" name="otherUserId" value={donor.id} />
                      <input type="hidden" name="requestId" value={request.id} />
                      <button type="submit" className={buttonClass.secondary}>
                        Message
                      </button>
                    </form>
                    <ReportButton reportedUserId={donor.id} />
                  </li>
                );
              })}
            </ul>
          )}
          {!active && request.status !== "CANCELLED" && (
            <form action={updateRequestStatusAction.bind(null, request.id, "OPEN")} className="mt-4">
              <button type="submit" className={buttonClass.small}>
                Re-open request
              </button>
            </form>
          )}
        </Card>
      )}
    </PageContainer>
  );
}
