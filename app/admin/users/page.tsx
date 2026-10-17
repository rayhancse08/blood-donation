import type { Metadata } from "next";
import type { Prisma } from "@/generated/prisma/client";
import { Avatar, Badge, BloodGroupSelect, buttonClass, inputClass, PageHeader } from "@/components/ui";
import { setUserRoleAction, setUserSuspendedAction } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { isBloodGroup } from "@/lib/blood";
import { bloodGroupLabel, VERIFICATION_STATUS_TONE } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDate, one } from "@/lib/format";

export const metadata: Metadata = { title: "Users" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const q = one(params.q).trim();
  const bloodGroup = one(params.bloodGroup);
  const donorOnly = one(params.donor) === "1";
  const suspendedOnly = one(params.suspended) === "1";

  const where: Prisma.UserWhereInput = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
            { email: { contains: q, mode: "insensitive" } },
            { district: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(isBloodGroup(bloodGroup) ? { bloodGroup } : {}),
    ...(donorOnly ? { isDonor: true } : {}),
    ...(suspendedOnly ? { isSuspended: true } : {}),
  };

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { _count: { select: { donations: { where: { status: "VERIFIED" } }, bloodRequests: true, reportsReceived: true } } },
    }),
    db.user.count({ where }),
  ]);

  return (
    <div>
      <PageHeader title="Users & donors" description={`${total} matching user(s)`} />
      <form className="mb-4 grid gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-5 sm:items-center">
        <input name="q" defaultValue={q} placeholder="Name, phone, email or district" className={`${inputClass} sm:col-span-2`} />
        <BloodGroupSelect defaultValue={bloodGroup} placeholder="Any blood group" />
        <div className="flex flex-col text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="donor" value="1" defaultChecked={donorOnly} /> Donors only
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="suspended" value="1" defaultChecked={suspendedOnly} /> Suspended
          </label>
        </div>
        <button type="submit" className={buttonClass.dark}>
          Filter
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">User</th>
              <th>Blood</th>
              <th>Roles</th>
              <th>District</th>
              <th>ID</th>
              <th>Activity</th>
              <th>Joined</th>
              <th className="px-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id} className={u.isSuspended ? "bg-red-50/50" : ""}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Avatar name={u.name} src={u.photoUrl} size={32} />
                    <div>
                      <p className="font-medium">{u.name ?? "—"}</p>
                      <p className="text-xs text-gray-500">{u.phone ?? u.email}</p>
                    </div>
                  </div>
                </td>
                <td>{bloodGroupLabel(u.bloodGroup)}</td>
                <td className="space-x-1">
                  {u.role === "ADMIN" && <Badge tone="purple">Admin</Badge>}
                  {u.isDonor && <Badge tone="red">Donor{u.isAvailable ? " · available" : ""}</Badge>}
                  {u.isReceiver && <Badge>Receiver</Badge>}
                  {u.isSuspended && <Badge tone="red">Suspended</Badge>}
                </td>
                <td>{u.district ?? "—"}</td>
                <td>
                  <Badge tone={VERIFICATION_STATUS_TONE[u.idVerificationStatus]}>{u.idVerificationStatus.toLowerCase()}</Badge>
                </td>
                <td className="text-xs text-gray-600">
                  {u._count.donations} donations · {u._count.bloodRequests} requests
                  {u._count.reportsReceived > 0 && <span className="text-red-600"> · {u._count.reportsReceived} reports</span>}
                </td>
                <td className="text-xs">{formatDate(u.createdAt)}</td>
                <td className="px-4">
                  {u.id !== admin.id && (
                    <div className="flex flex-wrap gap-1">
                      <form action={setUserSuspendedAction.bind(null, u.id, !u.isSuspended)}>
                        <button type="submit" className={buttonClass.small}>
                          {u.isSuspended ? "Unsuspend" : "Suspend"}
                        </button>
                      </form>
                      <form action={setUserRoleAction.bind(null, u.id, u.role === "ADMIN" ? "USER" : "ADMIN")}>
                        <button type="submit" className={buttonClass.small}>
                          {u.role === "ADMIN" ? "Remove admin" : "Make admin"}
                        </button>
                      </form>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
