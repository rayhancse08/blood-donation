import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, buttonClass, Card, Field, inputClass, PageHeader } from "@/components/ui";
import { createMedicineAction } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { one } from "@/lib/format";

export const metadata: Metadata = { title: "Medicines" };

export default async function AdminMedicinesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const q = one((await searchParams).q).trim();
  const medicines = await db.medicine.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { genericName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {},
    orderBy: { name: "asc" },
    take: 200,
    include: { _count: { select: { stock: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Medicine catalogue" description="Partner pharmacies set prices and stock for medicines in this catalogue." />

      <Card title="Add a medicine">
        <ActionForm action={createMedicineAction} resetOnSuccess className="grid gap-4 sm:grid-cols-3">
          <Field label="Brand name" required>
            <input name="name" required maxLength={120} className={inputClass} />
          </Field>
          <Field label="Generic name">
            <input name="genericName" maxLength={120} className={inputClass} />
          </Field>
          <Field label="Manufacturer">
            <input name="manufacturer" maxLength={120} className={inputClass} />
          </Field>
          <Field label="Strength">
            <input name="strength" placeholder="500 mg" maxLength={50} className={inputClass} />
          </Field>
          <Field label="Form">
            <input name="form" placeholder="Tablet, Syrup…" maxLength={50} className={inputClass} />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" name="requiresPrescription" /> Prescription required
          </label>
          <Field label="Description" className="sm:col-span-3">
            <textarea name="description" rows={2} maxLength={1000} className={inputClass} />
          </Field>
          <Field label="Usage">
            <textarea name="usage" rows={2} maxLength={1000} className={inputClass} />
          </Field>
          <Field label="Side effects" className="sm:col-span-2">
            <textarea name="sideEffects" rows={2} maxLength={1000} className={inputClass} />
          </Field>
          <div className="sm:col-span-3">
            <SubmitButton>Add medicine</SubmitButton>
          </div>
        </ActionForm>
      </Card>

      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Search medicines" className={inputClass} />
        <button type="submit" className={buttonClass.dark}>
          Search
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Medicine</th>
              <th>Generic</th>
              <th>Manufacturer</th>
              <th>Pharmacies</th>
              <th className="px-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {medicines.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-3">
                  <Link href={`/pharmacy/medicines/${m.id}`} className="font-medium hover:underline">
                    {m.name} {m.strength}
                  </Link>
                  <p className="text-xs text-gray-500">{m.form}</p>
                </td>
                <td>{m.genericName ?? "—"}</td>
                <td>{m.manufacturer ?? "—"}</td>
                <td>{m._count.stock}</td>
                <td className="px-4">{m.requiresPrescription && <Badge tone="orange">Rx</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
