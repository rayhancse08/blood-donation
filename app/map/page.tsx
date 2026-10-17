import type { Metadata } from "next";
import { MapExplorer } from "@/components/map/MapExplorer";
import { PageContainer, PageHeader } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { DIVISION_NAMES, divisionCenter, isValidDistrict } from "@/lib/bd-locations";
import { isBloodGroup } from "@/lib/blood";
import { one } from "@/lib/format";

export const metadata: Metadata = { title: "Donor map" };

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();

  const bloodGroup = one(params.bloodGroup);
  const division = one(params.division);
  const district = one(params.district);
  const validDivision = DIVISION_NAMES.includes(division) ? division : "";

  const center: [number, number] =
    user?.latitude != null && user.longitude != null
      ? [user.latitude, user.longitude]
      : divisionCenter(validDivision || user?.division);

  return (
    <PageContainer className="max-w-7xl">
      <PageHeader
        title="Live donor map"
        description="Available donors and active blood requests update automatically. Tap a pin for details."
      />
      <MapExplorer
        isLoggedIn={!!user}
        initialCenter={center}
        initialFilters={{
          bloodGroup: isBloodGroup(bloodGroup) ? bloodGroup : "",
          compatible: one(params.compatible) === "1",
          division: validDivision,
          district: validDivision && isValidDistrict(validDivision, district) ? district : "",
        }}
      />
    </PageContainer>
  );
}
