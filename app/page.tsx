import Link from "next/link";
import { Badge, BloodGroupBadge, buttonClass } from "@/components/ui";
import { contentTypeLabel } from "@/lib/constants";
import { db } from "@/lib/db";
import { requestTime } from "@/lib/request-time";
import { visibleDonorWhere } from "@/lib/donors";
import { formatDate } from "@/lib/format";

const FEATURES = [
  { title: "Live donor map", text: "See available donors and active requests near you, filtered by blood group, division, district, upazila and thana.", href: "/map" },
  { title: "One-tap emergency", text: "Send an urgent request that instantly alerts matching donors nearby by push notification and SMS.", href: "/emergency" },
  { title: "Healthcare directory", text: "Hospitals, clinics, diagnostic centers, doctors, pharmacies, ambulances and blood banks.", href: "/directory" },
  { title: "Medicine marketplace", text: "Find medicine at nearby partner pharmacies, compare prices and order for delivery or pickup.", href: "/pharmacy" },
  { title: "Pay with discounts", text: "Pay hospitals, diagnostics and ambulances with bKash, Nagad and more, and save at partners.", href: "/pay" },
  { title: "AI health assistant", text: "Ask in Bangla or English to find donors, hospitals and medicines or learn about health topics.", href: "/assistant" },
  { title: "Rewards for donors", text: "Donation history, badges, levels, certificates and partner offers that grow with every donation.", href: "/donations" },
  { title: "Safe & private", text: "Only name and blood group are public. Contacts are shared after a donor accepts. Report and block anytime.", href: "/profile" },
];

export default async function HomePage() {
  const now = await requestTime();

  const [availableDonors, activeRequests, verifiedDonations, emergencies, latestContent] = await Promise.all([
    db.user.count({ where: visibleDonorWhere(now) }),
    db.bloodRequest.count({ where: { status: { in: ["OPEN", "ACCEPTED"] } } }),
    db.donation.count({ where: { status: "VERIFIED" } }),
    db.bloodRequest.findMany({
      where: { status: { in: ["OPEN", "ACCEPTED"] }, isEmergency: true },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, bloodGroup: true, hospitalName: true, district: true, units: true },
    }),
    db.content.findMany({
      where: { published: true },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, slug: true, title: true, summary: true, type: true, createdAt: true },
    }),
  ]);

  return (
    <div>
      <section className="bg-gradient-to-br from-red-600 via-red-600 to-rose-700 text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:gap-10 sm:py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <p className="mb-3 inline-block rounded-full bg-white/15 px-3 py-1 text-sm">Every drop counts</p>
            <h1 className="text-3xl font-extrabold leading-tight sm:text-5xl">Find blood donors near you, in minutes.</h1>
            <p className="mt-4 max-w-xl text-base text-red-50 sm:text-lg">
              Blood App connects donors and receivers using live location, blood group and verified profiles, with
              emergency alerts, hospitals, ambulances, medicine and payments in one place.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:flex sm:flex-wrap">
              <Link
                href="/map"
                className="col-span-2 rounded-lg bg-white px-5 py-3 text-center font-semibold text-red-700 shadow hover:bg-red-50 sm:col-span-1"
              >
                Find donors
              </Link>
              <Link href="/requests/new" className="rounded-lg border border-white/60 px-4 py-3 text-center font-semibold hover:bg-white/10 sm:px-5">
                Request blood
              </Link>
              <Link href="/profile#roles" className="rounded-lg border border-white/60 px-4 py-3 text-center font-semibold hover:bg-white/10 sm:px-5">
                Become a donor
              </Link>
            </div>
          </div>

          <div className="rounded-2xl bg-white/10 p-4 backdrop-blur sm:p-6">
            <Link
              href="/emergency"
              className="flex items-center justify-between gap-3 rounded-xl bg-white p-4 text-red-700 shadow-lg transition hover:scale-[1.01] sm:p-5"
            >
              <span className="min-w-0">
                <span className="block text-lg font-bold sm:text-xl">Emergency? Get blood now</span>
                <span className="text-sm text-gray-600">One tap alerts matching donors nearby</span>
              </span>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-600 text-2xl font-black text-white sm:h-14 sm:w-14">
                !
              </span>
            </Link>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center sm:mt-6 sm:gap-3">
              <div className="rounded-xl bg-white/10 p-2 sm:p-4">
                <p className="text-2xl font-bold sm:text-3xl">{availableDonors}</p>
                <p className="text-[11px] leading-tight text-red-100 sm:text-xs">Donors available now</p>
              </div>
              <div className="rounded-xl bg-white/10 p-2 sm:p-4">
                <p className="text-2xl font-bold sm:text-3xl">{activeRequests}</p>
                <p className="text-[11px] leading-tight text-red-100 sm:text-xs">Active requests</p>
              </div>
              <div className="rounded-xl bg-white/10 p-2 sm:p-4">
                <p className="text-2xl font-bold sm:text-3xl">{verifiedDonations}</p>
                <p className="text-[11px] leading-tight text-red-100 sm:text-xs">Verified donations</p>
              </div>
            </div>
            {emergencies.length > 0 && (
              <div className="mt-4 space-y-2 sm:mt-6">
                <p className="text-sm font-semibold">Live emergency requests</p>
                {emergencies.map((request) => (
                  <Link key={request.id} href={`/requests/${request.id}`} className="flex items-center gap-3 rounded-lg bg-white/90 p-3 text-gray-900 hover:bg-white">
                    <BloodGroupBadge group={request.bloodGroup} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {request.units} unit(s) at {request.hospitalName}
                      {request.district ? `, ${request.district}` : ""}
                    </span>
                    <Badge tone="red">Urgent</Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">More than blood donation</h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-gray-600">
          Everything you need in a medical emergency, and to stay healthy every day.
        </p>
        <div className="mt-8 grid gap-3 sm:mt-10 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <Link
              key={feature.title}
              href={feature.href}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-5"
            >
              <h3 className="font-semibold text-gray-900">{feature.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{feature.text}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-white py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-bold sm:text-3xl">How it works</h2>
          <ol className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-6 md:grid-cols-4">
            {[
              ["Sign up", "Register with your phone, email or Google. Everyone starts as a receiver."],
              ["Become a donor", "Turn on the donor role and set yourself as available whenever you can give."],
              ["Match & connect", "Requests alert compatible donors nearby. Accept, chat and call in the app."],
              ["Donate & get rewarded", "Submit proof, rest for 3 months while hidden, and earn badges and offers."],
            ].map(([title, text], index) => (
              <li key={title} className="rounded-xl bg-gray-50 p-4 sm:p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-sm font-bold text-white">{index + 1}</span>
                <p className="mt-3 font-semibold">{title}</p>
                <p className="mt-1 text-sm text-gray-600">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {latestContent.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <div className="mb-6 flex items-end justify-between gap-3">
            <h2 className="text-2xl font-bold sm:text-3xl">Health awareness</h2>
            <Link href="/awareness" className={buttonClass.secondary}>
              View all
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {latestContent.map((item) => (
              <Link key={item.id} href={`/awareness/${item.slug}`} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md sm:p-5">
                <Badge tone="purple">{contentTypeLabel(item.type)}</Badge>
                <h3 className="mt-3 font-semibold">{item.title}</h3>
                {item.summary && <p className="mt-1 line-clamp-3 text-sm text-gray-600">{item.summary}</p>}
                <p className="mt-3 text-xs text-gray-400">{formatDate(item.createdAt)}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
