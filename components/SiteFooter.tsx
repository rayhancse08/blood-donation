import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="no-print mt-12 border-t border-gray-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 text-sm text-gray-600 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-bold text-red-600">Blood App</p>
          <p className="mt-2">Connecting blood donors and receivers across Bangladesh, quickly and safely.</p>
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-gray-900">Blood</p>
          <Link href="/map" className="block hover:underline">Find donors</Link>
          <Link href="/requests/new" className="block hover:underline">Request blood</Link>
          <Link href="/emergency" className="block hover:underline">Emergency</Link>
          <Link href="/leaderboard" className="block hover:underline">Top donors</Link>
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-gray-900">Healthcare</p>
          <Link href="/directory" className="block hover:underline">Hospitals & doctors</Link>
          <Link href="/pharmacy" className="block hover:underline">Buy medicine</Link>
          <Link href="/pay" className="block hover:underline">Pay a provider</Link>
          <Link href="/partner" className="block hover:underline">Become a partner</Link>
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-gray-900">In an emergency</p>
          <a href="tel:999" className="block font-semibold text-red-600 hover:underline">Call 999 (National emergency)</a>
          <p className="text-xs text-gray-500">
            Information in this app is general and not a substitute for professional medical advice.
          </p>
        </div>
      </div>
    </footer>
  );
}
