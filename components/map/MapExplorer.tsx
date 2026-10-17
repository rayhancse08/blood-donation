"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { startConversationAction } from "@/lib/actions/messages";
import { DIVISIONS, districtsOf } from "@/lib/bd-locations";
import { BLOOD_GROUPS, bloodGroupLabel, labelOf, GENDERS } from "@/lib/constants";
import { formatDistance, haversineKm } from "@/lib/geo";
import { ReportButton } from "../ReportButton";
import { Avatar, Badge, BloodGroupBadge, buttonClass, cn, inputClass } from "../ui";
import type { DonorDetails, DonorPin, RequestPin, Selection } from "./types";

const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-gray-100" />,
});

type Filters = {
  bloodGroup: string;
  compatible: boolean;
  division: string;
  district: string;
  upazila: string;
  thana: string;
  show: "all" | "donors" | "requests";
};

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dhaka" });

export function MapExplorer({
  isLoggedIn,
  initialCenter,
  initialFilters,
}: {
  isLoggedIn: boolean;
  initialCenter: [number, number];
  initialFilters: Partial<Filters>;
}) {
  const [filters, setFilters] = useState<Filters>({
    bloodGroup: "",
    compatible: false,
    division: "",
    district: "",
    upazila: "",
    thana: "",
    show: "all",
    ...initialFilters,
  });
  const [data, setData] = useState<{ donors: DonorPin[]; requests: RequestPin[] }>({ donors: [], requests: [] });
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [me, setMe] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.bloodGroup) params.set("bloodGroup", filters.bloodGroup);
    if (filters.compatible) params.set("compatible", "1");
    if (filters.division) params.set("division", filters.division);
    if (filters.district) params.set("district", filters.district);
    if (filters.upazila.trim()) params.set("upazila", filters.upazila.trim());
    if (filters.thana.trim()) params.set("thana", filters.thana.trim());
    params.set("show", filters.show);
    return params.toString();
  }, [filters]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`/api/map?${query}`, { cache: "no-store" });
        if (!response.ok) return;
        const json = (await response.json()) as { donors: DonorPin[]; requests: RequestPin[] };
        if (!cancelled) {
          setData(json);
          setLoaded(true);
        }
      } catch {
        // retried on next poll
      }
    };
    load();
    const timer = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [query]);

  const origin = me ? { lat: me[0], lng: me[1] } : null;
  const sortedDonors = useMemo(() => {
    if (!me) return data.donors;
    const from = { lat: me[0], lng: me[1] };
    return [...data.donors].sort((a, b) => haversineKm(from, a) - haversineKm(from, b));
  }, [data.donors, me]);

  const selectedRequest = selected?.kind === "request" ? data.requests.find((r) => r.id === selected.id) : undefined;
  const detail =
    selected?.kind === "donor" ? (
      <DonorCard key={selected.id} id={selected.id} me={me} isLoggedIn={isLoggedIn} onClose={() => setSelected(null)} />
    ) : selectedRequest ? (
      <RequestCard request={selectedRequest} me={me} onClose={() => setSelected(null)} />
    ) : null;
  const extraFilterCount =
    [filters.division, filters.district, filters.upazila.trim(), filters.thana.trim()].filter(Boolean).length + (filters.show === "all" ? 0 : 1);

  const hasDetail = detail !== null;

  useEffect(() => {
    if (!hasDetail) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setSelected(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [hasDetail]);

  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value, ...(key === "division" ? { district: "" } : {}) }));
  }

  function locate() {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setMe([position.coords.latitude, position.coords.longitude]);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4 lg:grid-cols-7">
        <select
          value={filters.bloodGroup}
          onChange={(e) => update("bloodGroup", e.target.value)}
          className={cn(inputClass, "col-span-2 sm:col-span-1")}
          aria-label="Blood group"
        >
          <option value="">All blood groups</option>
          {BLOOD_GROUPS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
          className={cn(buttonClass.secondary, "sm:hidden")}
        >
          {filtersOpen ? "Hide filters" : "More filters"}
          {extraFilterCount > 0 && <span className="rounded-full bg-red-600 px-1.5 text-xs text-white">{extraFilterCount}</span>}
        </button>
        <button type="button" onClick={locate} className={cn(buttonClass.secondary, "sm:order-last")}>
          {locating ? "Locating…" : "Near me"}
        </button>
        <div className={cn(filtersOpen ? "col-span-2 grid grid-cols-2 gap-3" : "hidden", "sm:contents")}>
          <select value={filters.division} onChange={(e) => update("division", e.target.value)} className={inputClass} aria-label="Division">
            <option value="">All divisions</option>
            {DIVISIONS.map((d) => (
              <option key={d.name}>{d.name}</option>
            ))}
          </select>
          <select
            value={filters.district}
            onChange={(e) => update("district", e.target.value)}
            disabled={!filters.division}
            className={inputClass}
            aria-label="District"
          >
            <option value="">All districts</option>
            {districtsOf(filters.division).map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <input value={filters.upazila} onChange={(e) => update("upazila", e.target.value)} placeholder="Upazila" className={inputClass} />
          <input value={filters.thana} onChange={(e) => update("thana", e.target.value)} placeholder="Thana" className={inputClass} />
          <select
            value={filters.show}
            onChange={(e) => update("show", e.target.value as Filters["show"])}
            className={cn(inputClass, "col-span-2 sm:col-span-1")}
            aria-label="Show"
          >
            <option value="all">Donors & requests</option>
            <option value="donors">Donors only</option>
            <option value="requests">Requests only</option>
          </select>
        </div>
        {filters.bloodGroup && (
          <label className="col-span-2 flex items-start gap-2 text-sm text-gray-700 sm:order-last lg:col-span-7">
            <input type="checkbox" checked={filters.compatible} onChange={(e) => update("compatible", e.target.checked)} className="mt-1" />
            Also show donors who are compatible with {bloodGroupLabel(filters.bloodGroup)} (e.g. O- for everyone)
          </label>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="relative h-[55vh] min-h-80 overflow-hidden rounded-xl border border-gray-200 shadow-sm sm:h-[60vh] lg:h-[65vh]">
          <LeafletMap center={initialCenter} donors={data.donors} requests={data.requests} me={me} selected={selected} onSelect={setSelected} />
          <div className="pointer-events-none absolute bottom-3 left-3 z-[500] flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-white px-2 py-1 shadow">{data.donors.length} donors</span>
            <span className="rounded-full bg-white px-2 py-1 shadow">{data.requests.length} requests</span>
            {!loaded && <span className="rounded-full bg-white px-2 py-1 shadow">Loading…</span>}
          </div>
        </div>

        <aside className="max-h-[70vh] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-sm lg:h-[65vh] lg:max-h-none">
          <div className={cn(detail && "lg:hidden")}>
            <ResultsList donors={sortedDonors} requests={data.requests} origin={origin} onSelect={setSelected} />
          </div>
          {detail && (
            <>
              <button
                type="button"
                aria-label="Close details"
                onClick={() => setSelected(null)}
                className="fixed inset-0 z-[1040] bg-black/30 lg:hidden"
              />
              <div
                role="dialog"
                aria-modal="true"
                className="fixed inset-x-0 bottom-[var(--mobile-nav-height)] z-[1050] max-h-[75dvh] overflow-y-auto overscroll-contain rounded-t-2xl bg-white shadow-2xl lg:static lg:z-auto lg:max-h-none lg:overflow-visible lg:rounded-none lg:shadow-none"
              >
                <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-gray-300 lg:hidden" aria-hidden />
                {detail}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function ResultsList({
  donors,
  requests,
  origin,
  onSelect,
}: {
  donors: DonorPin[];
  requests: RequestPin[];
  origin: { lat: number; lng: number } | null;
  onSelect: (selection: Selection) => void;
}) {
  return (
    <div className="divide-y divide-gray-100">
      {requests.length > 0 && (
        <div className="p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Active requests</h3>
          <ul className="space-y-2">
            {requests.slice(0, 30).map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => onSelect({ kind: "request", id: r.id })} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-gray-50">
                  <BloodGroupBadge group={r.bloodGroup} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.hospitalName}</span>
                    <span className="text-xs text-gray-500">
                      {r.units} unit(s){origin ? ` · ${formatDistance(haversineKm(origin, r))}` : ""}
                    </span>
                  </span>
                  {r.isEmergency && <Badge tone="red">Emergency</Badge>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="p-4">
        <h3 className="mb-2 text-sm font-semibold text-gray-900">Available donors</h3>
        {donors.length === 0 ? (
          <p className="text-sm text-gray-500">No available donors match these filters right now.</p>
        ) : (
          <ul className="space-y-2">
            {donors.slice(0, 50).map((d) => (
              <li key={d.id}>
                <button type="button" onClick={() => onSelect({ kind: "donor", id: d.id })} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-gray-50">
                  <BloodGroupBadge group={d.bloodGroup} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{d.name}</span>
                  {origin && <span className="text-xs text-gray-500">{formatDistance(haversineKm(origin, d))}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function DonorCard({
  id,
  me,
  isLoggedIn,
  onClose,
}: {
  id: string;
  me: [number, number] | null;
  isLoggedIn: boolean;
  onClose: () => void;
}) {
  const [donor, setDonor] = useState<DonorDetails | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;
    const qs = me ? `?lat=${me[0]}&lng=${me[1]}` : "";
    fetch(`/api/map/donors/${id}${qs}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 401 ? "Please sign in to view donor details." : "This donor is no longer available.");
        return (await response.json()) as DonorDetails;
      })
      .then((value) => !cancelled && setDonor(value))
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [id, me, isLoggedIn]);

  return (
    <div className="p-4 sm:p-5">
      <button type="button" onClick={onClose} className="mb-3 py-1 text-sm text-gray-600 hover:underline">
        ← Back to list
      </button>
      {!isLoggedIn ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">Sign in to see the donor&apos;s profile, distance and contact options.</p>
          <Link href="/login?next=/map" className={buttonClass.primary}>
            Sign in
          </Link>
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : !donor ? (
        <p className="text-sm text-gray-500">Loading profile…</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar name={donor.name} src={donor.photoUrl} size={56} />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{donor.name}</p>
              <div className="flex flex-wrap gap-1">
                <Badge tone="red">{bloodGroupLabel(donor.bloodGroup)}</Badge>
                {donor.verified && <Badge tone="green">ID verified</Badge>}
                <Badge tone="blue">{donor.donationCount} donation(s)</Badge>
              </div>
            </div>
          </div>
          <dl className="space-y-1 text-sm">
            <Row label="Distance">{formatDistance(donor.distanceKm) ?? "Unknown"}</Row>
            <Row label="Area">{donor.area}</Row>
            {donor.age != null && <Row label="Age">{donor.age}</Row>}
            {donor.gender && <Row label="Gender">{labelOf(GENDERS, donor.gender)}</Row>}
            <Row label="Last donation">{donor.lastDonationAt ? dateFormat.format(new Date(donor.lastDonationAt)) : "Not recorded"}</Row>
          </dl>

          {donor.contactPhone ? (
            <div className="rounded-lg bg-green-50 p-3 text-sm">
              <p className="font-medium text-green-800">This donor accepted your request.</p>
              <a href={`tel:${donor.contactPhone}`} className={cn(buttonClass.success, "mt-2 w-full")}>
                Call {donor.contactPhone}
              </a>
            </div>
          ) : (
            !donor.isSelf && (
              <p className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
                For privacy, phone numbers are shared only after the donor accepts your blood request. You can message them in the app.
              </p>
            )
          )}

          {!donor.isSelf && (
            <div className="flex flex-wrap gap-2">
              <form action={startConversationAction}>
                <input type="hidden" name="otherUserId" value={donor.id} />
                <button type="submit" className={buttonClass.primary}>
                  Message
                </button>
              </form>
              <Link href={`/requests/new?bloodGroup=${donor.bloodGroup}`} className={buttonClass.secondary}>
                Post a request
              </Link>
              <ReportButton reportedUserId={donor.id} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RequestCard({ request, me, onClose }: { request: RequestPin; me: [number, number] | null; onClose: () => void }) {
  const distance = me ? haversineKm({ lat: me[0], lng: me[1] }, request) : null;
  return (
    <div className="space-y-4 p-4 sm:p-5">
      <button type="button" onClick={onClose} className="py-1 text-sm text-gray-600 hover:underline">
        ← Back to list
      </button>
      <div className="flex items-center gap-3">
        <BloodGroupBadge group={request.bloodGroup} size="lg" />
        <div className="min-w-0">
          <p className="text-lg font-semibold">{request.hospitalName}</p>
          <div className="flex flex-wrap gap-1">
            {request.isEmergency && <Badge tone="red">Emergency</Badge>}
            <Badge tone={request.urgency === "CRITICAL" ? "red" : request.urgency === "URGENT" ? "orange" : "gray"}>{request.urgency.toLowerCase()}</Badge>
            <Badge tone="blue">{request.status.toLowerCase()}</Badge>
          </div>
        </div>
      </div>
      <dl className="space-y-1 text-sm">
        <Row label="Units needed">{request.units}</Row>
        <Row label="Needed by">{dateFormat.format(new Date(request.neededBy))}</Row>
        {request.district && <Row label="District">{request.district}</Row>}
        {distance != null && <Row label="Distance">{formatDistance(distance)}</Row>}
      </dl>
      <Link href={`/requests/${request.id}`} className={cn(buttonClass.primary, "w-full")}>
        View request & respond
      </Link>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-gray-100 py-1.5">
      <dt className="shrink-0 text-gray-500">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium">{children}</dd>
    </div>
  );
}
