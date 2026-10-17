import type { Metadata } from "next";
import { CheckoutForm } from "@/components/pharmacy/CheckoutForm";
import { PageContainer, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const user = await requireUser();
  const defaultAddress = [user.addressLine, user.thana, user.upazila, user.district].filter(Boolean).join(", ");

  return (
    <PageContainer>
      <PageHeader title="Checkout" description="Review your medicines, choose delivery or pickup, and pay securely." />
      <CheckoutForm defaultPhone={user.contactPhone ?? user.phone ?? ""} defaultAddress={defaultAddress} />
    </PageContainer>
  );
}
