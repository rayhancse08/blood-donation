import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/lib/actions/auth";
import { switchModeAction } from "@/lib/actions/profile";
import { getCurrentUser } from "@/lib/auth";
import { Dropdown } from "./Dropdown";
import { LiveLocationSharer } from "./LiveLocationSharer";
import { NotificationBell } from "./NotificationBell";
import { Avatar, cn } from "./ui";

const NAV_LINKS = [
  { href: "/map", label: "Donor map" },
  { href: "/requests", label: "Requests" },
  { href: "/directory", label: "Directory" },
  { href: "/pharmacy", label: "Pharmacy" },
  { href: "/awareness", label: "Awareness" },
  { href: "/assistant", label: "AI assistant" },
];

export function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-1.5 text-base font-bold text-red-600 sm:gap-2 sm:text-lg">
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden>
        <path d="M12 2.5c-.3 0-.6.2-.8.4C9.6 5 5 11 5 15a7 7 0 0 0 14 0c0-4-4.6-10-6.2-12.1a1 1 0 0 0-.8-.4Z" />
      </svg>
      Blood App
    </Link>
  );
}

export function HeaderShell() {
  return (
    <header className="sticky top-0 z-[1100] border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-3 sm:h-16 sm:px-4">
        <Logo />
      </div>
    </header>
  );
}

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-[1100] border-b border-gray-200 bg-white/95 backdrop-blur no-print">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 sm:h-16 sm:gap-4 sm:px-4">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <Link
            href="/emergency"
            className="hidden rounded-full bg-red-600 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-red-700 sm:inline-flex"
          >
            Emergency
          </Link>

          {user ? (
            <>
              {user.isDonor && user.isAvailable && <LiveLocationSharer />}
              <NotificationBell />
              <Dropdown label={<Avatar name={user.name ?? user.phone ?? user.email} src={user.photoUrl} size={32} />}>
                <div className="border-b border-gray-100 px-3 pb-2 pt-1">
                  <p className="truncate text-sm font-semibold">{user.name ?? "New user"}</p>
                  <p className="truncate text-xs text-gray-500">{user.phone ?? user.email}</p>
                  {(user.isDonor && user.isReceiver) && (
                    <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1 text-xs">
                      {(["RECEIVER", "DONOR"] as const).map((mode) => (
                        <form key={mode} action={switchModeAction.bind(null, mode)}>
                          <button
                            type="submit"
                            className={cn(
                              "w-full rounded-md py-1 font-medium",
                              user.activeMode === mode ? "bg-white text-red-600 shadow-sm" : "text-gray-600",
                            )}
                          >
                            {mode === "RECEIVER" ? "Receiver" : "Donor"}
                          </button>
                        </form>
                      ))}
                    </div>
                  )}
                </div>
                <MenuLink href="/dashboard">Dashboard</MenuLink>
                <MenuLink href="/profile">Profile & settings</MenuLink>
                <MenuLink href="/messages">Messages</MenuLink>
                <MenuLink href="/donations">Donations & rewards</MenuLink>
                <MenuLink href="/orders">Medicine orders</MenuLink>
                <MenuLink href="/payments">Payments</MenuLink>
                <MenuLink href="/partner">Partner portal</MenuLink>
                {user.role === "ADMIN" && <MenuLink href="/admin">Admin panel</MenuLink>}
                <div className="lg:hidden">
                  <div className="my-1 border-t border-gray-100" />
                  <MenuLink href="/emergency">Emergency</MenuLink>
                  {NAV_LINKS.map((link) => (
                    <MenuLink key={link.href} href={link.href}>
                      {link.label}
                    </MenuLink>
                  ))}
                </div>
                <form action={logoutAction} className="mt-1 border-t border-gray-100 pt-1">
                  <button type="submit" className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50">
                    Sign out
                  </button>
                </form>
              </Dropdown>
            </>
          ) : (
            <>
              <Link href="/login" className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-100">
                Sign in
              </Link>
              <div className="lg:hidden">
                <Dropdown
                  label={
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} aria-label="Menu">
                      <path d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  }
                >
                  <MenuLink href="/emergency">Emergency</MenuLink>
                  {NAV_LINKS.map((link) => (
                    <MenuLink key={link.href} href={link.href}>
                      {link.label}
                    </MenuLink>
                  ))}
                </Dropdown>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="block rounded-lg px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 sm:py-2">
      {children}
    </Link>
  );
}
