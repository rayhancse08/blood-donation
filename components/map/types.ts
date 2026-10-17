export type DonorPin = { id: string; name: string; bloodGroup: string; lat: number; lng: number };

export type RequestPin = {
  id: string;
  bloodGroup: string;
  hospitalName: string;
  units: number;
  urgency: string;
  isEmergency: boolean;
  status: string;
  district: string | null;
  neededBy: string;
  lat: number;
  lng: number;
};

export type Selection = { kind: "donor" | "request"; id: string };

export type DonorDetails = {
  id: string;
  name: string;
  photoUrl: string | null;
  bloodGroup: string;
  age: number | null;
  gender: string | null;
  area: string;
  lastDonationAt: string | null;
  donationCount: number;
  verified: boolean;
  distanceKm: number | null;
  contactPhone: string | null;
  isSelf: boolean;
};
