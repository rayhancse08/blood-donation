export type Division = { name: string; center: [number, number]; districts: string[] };

export const DIVISIONS: Division[] = [
  {
    name: "Barishal",
    center: [22.701, 90.3535],
    districts: ["Barguna", "Barishal", "Bhola", "Jhalokati", "Patuakhali", "Pirojpur"],
  },
  {
    name: "Chattogram",
    center: [22.3569, 91.7832],
    districts: [
      "Bandarban",
      "Brahmanbaria",
      "Chandpur",
      "Chattogram",
      "Cox's Bazar",
      "Cumilla",
      "Feni",
      "Khagrachhari",
      "Lakshmipur",
      "Noakhali",
      "Rangamati",
    ],
  },
  {
    name: "Dhaka",
    center: [23.8103, 90.4125],
    districts: [
      "Dhaka",
      "Faridpur",
      "Gazipur",
      "Gopalganj",
      "Kishoreganj",
      "Madaripur",
      "Manikganj",
      "Munshiganj",
      "Narayanganj",
      "Narsingdi",
      "Rajbari",
      "Shariatpur",
      "Tangail",
    ],
  },
  {
    name: "Khulna",
    center: [22.8456, 89.5403],
    districts: [
      "Bagerhat",
      "Chuadanga",
      "Jashore",
      "Jhenaidah",
      "Khulna",
      "Kushtia",
      "Magura",
      "Meherpur",
      "Narail",
      "Satkhira",
    ],
  },
  {
    name: "Mymensingh",
    center: [24.7471, 90.4203],
    districts: ["Jamalpur", "Mymensingh", "Netrokona", "Sherpur"],
  },
  {
    name: "Rajshahi",
    center: [24.3745, 88.6042],
    districts: ["Bogura", "Chapai Nawabganj", "Joypurhat", "Naogaon", "Natore", "Pabna", "Rajshahi", "Sirajganj"],
  },
  {
    name: "Rangpur",
    center: [25.7439, 89.2752],
    districts: ["Dinajpur", "Gaibandha", "Kurigram", "Lalmonirhat", "Nilphamari", "Panchagarh", "Rangpur", "Thakurgaon"],
  },
  {
    name: "Sylhet",
    center: [24.8949, 91.8687],
    districts: ["Habiganj", "Moulvibazar", "Sunamganj", "Sylhet"],
  },
];

export const DIVISION_NAMES = DIVISIONS.map((d) => d.name);
export const BANGLADESH_CENTER: [number, number] = [23.685, 90.3563];

export function districtsOf(division: string | null | undefined): string[] {
  return DIVISIONS.find((d) => d.name === division)?.districts ?? [];
}

export function isValidDistrict(division: string, district: string) {
  return districtsOf(division).includes(district);
}

export function divisionCenter(division: string | null | undefined): [number, number] {
  return DIVISIONS.find((d) => d.name === division)?.center ?? BANGLADESH_CENTER;
}

export function formatArea(parts: { thana?: string | null; upazila?: string | null; district?: string | null; division?: string | null }) {
  return [parts.thana, parts.upazila, parts.district, parts.division].filter(Boolean).join(", ") || "Location not set";
}
