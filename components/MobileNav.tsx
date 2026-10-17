"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "./ui";

type NavItem = { href: string; label: string; icon: ReactNode };

const iconProps = {
  viewBox: "0 0 24 24",
  className: "h-6 w-6",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

const ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Home",
    icon: (
      <svg {...iconProps}>
        <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
      </svg>
    ),
  },
  {
    href: "/map",
    label: "Map",
    icon: (
      <svg {...iconProps}>
        <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
        <circle cx="12" cy="9.5" r="2.5" />
      </svg>
    ),
  },
  {
    href: "/requests",
    label: "Requests",
    icon: (
      <svg {...iconProps}>
        <path d="M9 4h6M9 4a2 2 0 0 0-2 2H5v15h14V6h-2a2 2 0 0 0-2-2M9 4a2 2 0 0 1 2-1h2a2 2 0 0 1 2 1" />
        <path d="M9 12h6M9 16h4" />
      </svg>
    ),
  },
  {
    href: "/directory",
    label: "Directory",
    icon: (
      <svg {...iconProps}>
        <path d="M4 21V7l8-4 8 4v14" />
        <path d="M10 21v-5h4v5M12 8v4M10 10h4" />
      </svg>
    ),
  },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
        active ? "text-red-600" : "text-gray-500 hover:text-gray-900",
      )}
    >
      {item.icon}
      {item.label}
    </Link>
  );
}

function Bar({ pathname }: { pathname: string | null }) {
  const [home, map, requests, directory] = ITEMS;
  const emergencyActive = pathname === "/emergency";

  return (
    <nav
      aria-label="Primary"
      className="no-print fixed inset-x-0 bottom-0 z-[1100] border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <div className="mx-auto flex h-16 max-w-lg items-stretch px-2">
        <NavLink item={home!} active={!!pathname && isActive(pathname, home!.href)} />
        <NavLink item={map!} active={!!pathname && isActive(pathname, map!.href)} />
        <Link
          href="/emergency"
          aria-current={emergencyActive ? "page" : undefined}
          className="flex flex-1 flex-col items-center justify-end pb-1.5 text-[11px] font-bold text-red-600"
        >
          <span
            className={cn(
              "-mt-6 mb-0.5 flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-sm font-extrabold text-white shadow-lg ring-4 ring-white",
              emergencyActive && "bg-red-700",
            )}
          >
            SOS
          </span>
          Emergency
        </Link>
        <NavLink item={requests!} active={!!pathname && isActive(pathname, requests!.href)} />
        <NavLink item={directory!} active={!!pathname && isActive(pathname, directory!.href)} />
      </div>
    </nav>
  );
}

/** Fixed bottom navigation for phones and tablets; the header nav takes over at `lg`. */
export function MobileNav() {
  return <Bar pathname={usePathname()} />;
}

export function MobileNavShell() {
  return <Bar pathname={null} />;
}
