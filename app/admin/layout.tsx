import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users & donors" },
  { href: "/admin/verifications", label: "Verifications" },
  { href: "/admin/requests", label: "Blood requests" },
  { href: "/admin/facilities", label: "Facilities & partners" },
  { href: "/admin/doctors", label: "Doctors" },
  { href: "/admin/medicines", label: "Medicines" },
  { href: "/admin/payments", label: "Payments & discounts" },
  { href: "/admin/content", label: "Awareness content" },
  { href: "/admin/notifications", label: "Notifications" },
  { href: "/admin/reports", label: "Reports & moderation" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 lg:flex-row">
      <aside className="lg:w-56 lg:shrink-0">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Admin panel</p>
        <nav className="flex gap-1 overflow-x-auto lg:flex-col">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-white hover:shadow-sm">
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
