import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { PageContainer } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { bloodGroupLabel } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Donation certificate" };

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const donation = await db.donation.findFirst({
    where: { id, status: "VERIFIED", ...(user.role === "ADMIN" ? {} : { donorId: user.id }) },
    include: { donor: { select: { name: true, bloodGroup: true } } },
  });
  if (!donation) notFound();

  const number = await db.donation.count({
    where: { donorId: donation.donorId, status: "VERIFIED", donatedAt: { lte: donation.donatedAt } },
  });

  return (
    <PageContainer className="max-w-3xl">
      <div className="mb-4 flex justify-end">
        <PrintButton />
      </div>
      <div className="relative overflow-hidden rounded-2xl border-8 border-double border-red-600 bg-white p-10 text-center shadow-lg">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-600">Certificate of appreciation</p>
        <h1 className="mt-6 text-4xl font-extrabold text-gray-900">{donation.donor.name}</h1>
        <p className="mt-4 text-lg text-gray-700">
          is recognised for voluntarily donating blood ({bloodGroupLabel(donation.donor.bloodGroup)}) on{" "}
          <strong>{formatDate(donation.donatedAt)}</strong> at <strong>{donation.place}</strong>.
        </p>
        <p className="mt-4 text-gray-600">This was their donation number {number} recorded on Blood App. Thank you for saving lives.</p>
        <div className="mt-10 flex items-end justify-between text-left text-xs text-gray-500">
          <div>
            <p className="font-semibold text-gray-900">Blood App</p>
            <p>Verified on {formatDate(donation.reviewedAt)}</p>
          </div>
          <div className="text-right">
            <p>Certificate ID</p>
            <p className="font-mono">{donation.id}</p>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
