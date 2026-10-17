import type { Metadata } from "next";
import { Badge, buttonClass, Card, EmptyState, inputClass, PageHeader, Tabs } from "@/components/ui";
import { reviewDonationAction, reviewIdentityAction } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { bloodGroupLabel, ID_TYPES, labelOf } from "@/lib/constants";
import { decrypt } from "@/lib/crypto";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, one } from "@/lib/format";
import { fileUrl } from "@/lib/storage";

export const metadata: Metadata = { title: "Verifications" };

function safeDecrypt(value: string | null) {
  if (!value) return "—";
  try {
    return decrypt(value);
  } catch {
    return "(unreadable)";
  }
}

export default async function VerificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const tab = one(params.tab) === "identity" ? "identity" : "donations";

  return (
    <div>
      <PageHeader title="Verification review" description="Review donation proofs and identity documents." />
      <Tabs
        active={tab}
        items={[
          { key: "donations", label: "Donation proofs", href: "/admin/verifications" },
          { key: "identity", label: "NID / birth registration", href: "/admin/verifications?tab=identity" },
        ]}
      />
      {tab === "donations" ? <DonationQueue /> : <IdentityQueue />}
    </div>
  );
}

async function DonationQueue() {
  const donations = await db.donation.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: {
      donor: { select: { name: true, phone: true, bloodGroup: true, lastDonationAt: true } },
      request: { select: { hospitalName: true, bloodGroup: true } },
      facility: { select: { name: true } },
    },
    take: 50,
  });

  if (donations.length === 0) return <EmptyState title="No pending donation proofs" />;

  return (
    <div className="space-y-4">
      {donations.map((d) => (
        <Card key={d.id} title={`${d.donor.name ?? "Donor"} · ${bloodGroupLabel(d.donor.bloodGroup)}`} actions={<span className="text-xs text-gray-500">Submitted {formatDateTime(d.createdAt)}</span>}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1 text-sm">
              <p>
                <strong>Donated:</strong> {formatDate(d.donatedAt)} · {d.units} unit(s)
              </p>
              <p>
                <strong>Place:</strong> {d.facility?.name ?? d.place}
              </p>
              {d.request && (
                <p>
                  <strong>Request:</strong> {bloodGroupLabel(d.request.bloodGroup)} at {d.request.hospitalName}
                </p>
              )}
              {d.receiverName && (
                <p>
                  <strong>Receiver:</strong> {d.receiverName}
                </p>
              )}
              <p>
                <strong>Previous donation:</strong> {formatDate(d.donor.lastDonationAt)}
              </p>
              <p>
                <strong>Phone:</strong> {d.donor.phone ?? "—"}
              </p>
              <a href={fileUrl(d.documentKey)!} target="_blank" className="inline-block text-red-600 hover:underline">
                Open proof document
              </a>
            </div>
            <form className="space-y-2">
              <textarea name="note" rows={2} placeholder="Note to donor (required when rejecting)" className={inputClass} />
              <div className="flex flex-wrap gap-2">
                <button formAction={reviewDonationAction.bind(null, d.id, true)} className={buttonClass.success}>
                  Verify donation
                </button>
                <button formAction={reviewDonationAction.bind(null, d.id, false)} className={buttonClass.danger}>
                  Reject
                </button>
              </div>
            </form>
          </div>
        </Card>
      ))}
    </div>
  );
}

async function IdentityQueue() {
  const users = await db.user.findMany({
    where: { idVerificationStatus: "PENDING" },
    orderBy: { updatedAt: "asc" },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      dateOfBirth: true,
      gender: true,
      district: true,
      idType: true,
      idNumberEncrypted: true,
      idDocumentKey: true,
    },
    take: 50,
  });

  if (users.length === 0) return <EmptyState title="No pending identity verifications" />;

  return (
    <div className="space-y-4">
      {users.map((u) => (
        <Card key={u.id} title={u.name ?? "User"} actions={<Badge tone="yellow">Pending</Badge>}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1 text-sm">
              <p>
                <strong>{labelOf(ID_TYPES, u.idType)}:</strong> <span className="font-mono">{safeDecrypt(u.idNumberEncrypted)}</span>
              </p>
              <p>
                <strong>Date of birth:</strong> {formatDate(u.dateOfBirth)}
              </p>
              <p>
                <strong>Gender:</strong> {u.gender?.toLowerCase() ?? "—"} · <strong>District:</strong> {u.district ?? "—"}
              </p>
              <p>
                <strong>Contact:</strong> {u.phone ?? u.email}
              </p>
              {u.idDocumentKey ? (
                <a href={fileUrl(u.idDocumentKey)!} target="_blank" className="inline-block text-red-600 hover:underline">
                  Open ID document
                </a>
              ) : (
                <p className="text-gray-500">No document uploaded</p>
              )}
            </div>
            <form className="space-y-2">
              <textarea name="note" rows={2} placeholder="Note to user (required when rejecting)" className={inputClass} />
              <div className="flex flex-wrap gap-2">
                <button formAction={reviewIdentityAction.bind(null, u.id, true)} className={buttonClass.success}>
                  Approve
                </button>
                <button formAction={reviewIdentityAction.bind(null, u.id, false)} className={buttonClass.danger}>
                  Reject
                </button>
              </div>
            </form>
          </div>
        </Card>
      ))}
    </div>
  );
}
