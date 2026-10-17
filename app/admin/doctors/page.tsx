import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { GeoInputs } from "@/components/GeoInputs";
import { LocationFields } from "@/components/LocationFields";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, buttonClass, Card, Field, inputClass, PageHeader } from "@/components/ui";
import { createDoctorAction, toggleDoctorActiveAction } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatTaka } from "@/lib/money";

export const metadata: Metadata = { title: "Doctors" };

export default async function AdminDoctorsPage() {
  await requireAdmin();
  const [doctors, facilities] = await Promise.all([
    db.doctor.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { facility: { select: { name: true } } } }),
    db.facility.findMany({
      where: { type: { in: ["HOSPITAL", "CLINIC", "DIAGNOSTIC_CENTER"] }, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, district: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Doctors" description="Doctor listings shown in the healthcare directory." />

      <Card title="Add a doctor">
        <ActionForm action={createDoctorAction} resetOnSuccess className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required>
            <input name="name" required maxLength={120} className={inputClass} />
          </Field>
          <Field label="Speciality" required>
            <input name="speciality" required placeholder="e.g. Haematology" maxLength={120} className={inputClass} />
          </Field>
          <Field label="Qualifications">
            <input name="qualifications" placeholder="MBBS, FCPS" maxLength={300} className={inputClass} />
          </Field>
          <Field label="Phone / serial number">
            <input name="phone" maxLength={30} className={inputClass} />
          </Field>
          <Field label="Hospital / clinic">
            <select name="facilityId" className={inputClass}>
              <option value="">Independent chamber</option>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                  {f.district ? ` (${f.district})` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Chamber name">
            <input name="chamberName" maxLength={150} className={inputClass} />
          </Field>
          <Field label="Chamber address" className="sm:col-span-2">
            <input name="chamberAddress" maxLength={300} className={inputClass} />
          </Field>
          <LocationFields showUpazilaThana={false} />
          <Field label="Visiting hours">
            <input name="visitingHours" placeholder="Sat-Thu, 5pm - 9pm" maxLength={150} className={inputClass} />
          </Field>
          <Field label="Consultation fee (৳)">
            <input name="consultationFee" type="number" min={0} step="1" className={inputClass} />
          </Field>
          <Field label="Bio" className="sm:col-span-2">
            <textarea name="bio" rows={3} maxLength={1000} className={inputClass} />
          </Field>
          <div className="sm:col-span-2">
            <GeoInputs label="Use my current location as the chamber location" />
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>Add doctor</SubmitButton>
          </div>
        </ActionForm>
      </Card>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Doctor</th>
              <th>Speciality</th>
              <th>Chamber</th>
              <th>Fee</th>
              <th className="px-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {doctors.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-3">
                  <Link href={`/directory/doctors/${d.id}`} className="font-medium hover:underline">
                    {d.name}
                  </Link>
                  <p className="text-xs text-gray-500">{d.qualifications}</p>
                </td>
                <td>{d.speciality}</td>
                <td className="text-xs">
                  {d.facility?.name ?? d.chamberName ?? "—"}
                  {d.district ? `, ${d.district}` : ""}
                </td>
                <td>{d.consultationFee != null ? formatTaka(d.consultationFee) : "—"}</td>
                <td className="px-4">
                  <div className="flex items-center gap-2">
                    <Badge tone={d.isActive ? "green" : "gray"}>{d.isActive ? "Listed" : "Hidden"}</Badge>
                    <form action={toggleDoctorActiveAction.bind(null, d.id)}>
                      <button type="submit" className={buttonClass.small}>
                        {d.isActive ? "Hide" : "Show"}
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
