import type { Metadata } from "next";
import Link from "next/link";
import { PayForm } from "@/components/PayForm";
import { Card, PageContainer, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { one } from "@/lib/format";

export const metadata: Metadata = { title: "Pay a provider" };

export default async function PayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const providers = await db.facility.findMany({
    where: { partnerStatus: "APPROVED", isActive: true, type: { not: "PHARMACY" } },
    select: { id: true, name: true, type: true, district: true, discountPercent: true },
    orderBy: [{ name: "asc" }],
    take: 500,
  });
  const sorted = [...providers].sort((a, b) => Number(b.district === user.district) - Number(a.district === user.district));

  return (
    <PageContainer className="max-w-2xl">
      <PageHeader
        title="Pay a provider"
        description="Pay hospitals, clinics, diagnostic centers and ambulance services with bKash, Nagad, card or bank, and get partner discounts automatically."
      />
      <Card>
        <PayForm providers={sorted} defaultProviderId={one(params.facility) || undefined} />
      </Card>
      <p className="mt-4 text-center text-sm text-gray-600">
        <Link href="/payments" className="text-red-600 hover:underline">
          View payment history & receipts
        </Link>
      </p>
    </PageContainer>
  );
}
