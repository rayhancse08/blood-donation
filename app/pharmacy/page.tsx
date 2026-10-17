import type { Metadata } from "next";
import Link from "next/link";
import { CartBar } from "@/components/pharmacy/CartWidgets";
import { Badge, buttonClass, EmptyState, inputClass, PageContainer, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { one } from "@/lib/format";
import { formatTaka } from "@/lib/money";

export const metadata: Metadata = { title: "Pharmacy" };

export default async function PharmacyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = one(params.q).trim();

  const medicines = await db.medicine.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { genericName: { contains: q, mode: "insensitive" } },
            { manufacturer: { contains: q, mode: "insensitive" } },
          ],
        }
      : { stock: { some: { quantity: { gt: 0 } } } },
    include: {
      stock: {
        where: { quantity: { gt: 0 }, pharmacy: { isActive: true } },
        select: { price: true },
      },
    },
    orderBy: { name: "asc" },
    take: 60,
  });

  return (
    <PageContainer>
      <PageHeader
        title="Buy medicine"
        description="Search a medicine to see which nearby partner pharmacies have it, compare prices, and order for home delivery or pickup."
        actions={
          <Link href="/orders" className={buttonClass.secondary}>
            My orders
          </Link>
        }
      />

      <form className="mb-6 flex gap-2">
        <input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Brand or generic name, e.g. Napa"
          aria-label="Search medicine"
          className={inputClass}
        />
        <button type="submit" className={`${buttonClass.primary} shrink-0`}>
          Search
        </button>
      </form>

      {medicines.length === 0 ? (
        <EmptyState title="No medicines found" description={q ? `Nothing matched "${q}".` : "No partner pharmacy has listed medicines yet."} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {medicines.map((medicine) => {
            const prices = medicine.stock.map((s) => s.price);
            return (
              <Link key={medicine.id} href={`/pharmacy/medicines/${medicine.id}`} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">
                    {medicine.name} <span className="font-normal text-gray-500">{medicine.strength}</span>
                  </p>
                  {medicine.requiresPrescription && <Badge tone="orange">Rx</Badge>}
                </div>
                <p className="text-sm text-gray-600">{medicine.genericName}</p>
                <p className="text-xs text-gray-500">
                  {medicine.form}
                  {medicine.manufacturer ? ` · ${medicine.manufacturer}` : ""}
                </p>
                <p className="mt-3 text-sm">
                  {prices.length ? (
                    <>
                      From <strong>{formatTaka(Math.min(...prices))}</strong> at {prices.length} pharmac{prices.length === 1 ? "y" : "ies"}
                    </>
                  ) : (
                    <span className="text-gray-500">Currently not in stock nearby</span>
                  )}
                </p>
              </Link>
            );
          })}
        </div>
      )}
      <CartBar />
    </PageContainer>
  );
}
