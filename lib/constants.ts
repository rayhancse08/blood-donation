export type Option<T extends string = string> = { value: T; label: string };
export type Tone = "red" | "green" | "yellow" | "blue" | "gray" | "purple" | "orange";

export function labelOf(options: readonly Option[], value: string | null | undefined, fallback = "—") {
  return options.find((o) => o.value === value)?.label ?? fallback;
}

export const BLOOD_GROUPS = [
  { value: "A_POS", label: "A+" },
  { value: "A_NEG", label: "A-" },
  { value: "B_POS", label: "B+" },
  { value: "B_NEG", label: "B-" },
  { value: "AB_POS", label: "AB+" },
  { value: "AB_NEG", label: "AB-" },
  { value: "O_POS", label: "O+" },
  { value: "O_NEG", label: "O-" },
] as const satisfies readonly Option[];
export type BloodGroupValue = (typeof BLOOD_GROUPS)[number]["value"];
export const BLOOD_GROUP_VALUES = BLOOD_GROUPS.map((g) => g.value);
export const bloodGroupLabel = (value: string | null | undefined) => labelOf(BLOOD_GROUPS, value);

export const GENDERS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
] as const satisfies readonly Option[];
export const GENDER_VALUES = GENDERS.map((g) => g.value);

export const URGENCIES = [
  { value: "NORMAL", label: "Normal" },
  { value: "URGENT", label: "Urgent" },
  { value: "CRITICAL", label: "Critical" },
] as const satisfies readonly Option[];
export const URGENCY_VALUES = URGENCIES.map((u) => u.value);
export const URGENCY_TONE: Record<string, Tone> = { NORMAL: "gray", URGENT: "orange", CRITICAL: "red" };

export const REQUEST_STATUSES = [
  { value: "OPEN", label: "Open" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "FULFILLED", label: "Fulfilled" },
  { value: "CANCELLED", label: "Cancelled" },
] as const satisfies readonly Option[];
export const REQUEST_STATUS_VALUES = REQUEST_STATUSES.map((s) => s.value);
export const REQUEST_STATUS_TONE: Record<string, Tone> = {
  OPEN: "blue",
  ACCEPTED: "yellow",
  FULFILLED: "green",
  CANCELLED: "gray",
};

export const DONATION_STATUS_TONE: Record<string, Tone> = { PENDING: "yellow", VERIFIED: "green", REJECTED: "red" };
export const VERIFICATION_STATUS_TONE: Record<string, Tone> = {
  NONE: "gray",
  PENDING: "yellow",
  VERIFIED: "green",
  REJECTED: "red",
};

export const FACILITY_TYPES = [
  { value: "HOSPITAL", label: "Hospital" },
  { value: "CLINIC", label: "Clinic" },
  { value: "DIAGNOSTIC_CENTER", label: "Diagnostic center" },
  { value: "PHARMACY", label: "Pharmacy" },
  { value: "AMBULANCE", label: "Ambulance service" },
  { value: "DONATION_CENTER", label: "Donation center" },
  { value: "BLOOD_BANK", label: "Blood bank" },
] as const satisfies readonly Option[];
export type FacilityTypeValue = (typeof FACILITY_TYPES)[number]["value"];
export const FACILITY_TYPE_VALUES = FACILITY_TYPES.map((t) => t.value);
export const facilityTypeLabel = (value: string | null | undefined) => labelOf(FACILITY_TYPES, value);

export const PARTNER_STATUSES = [
  { value: "NONE", label: "Directory listing" },
  { value: "PENDING", label: "Pending review" },
  { value: "APPROVED", label: "Approved partner" },
  { value: "REJECTED", label: "Rejected" },
  { value: "SUSPENDED", label: "Suspended" },
] as const satisfies readonly Option[];
export const PARTNER_STATUS_TONE: Record<string, Tone> = {
  NONE: "gray",
  PENDING: "yellow",
  APPROVED: "green",
  REJECTED: "red",
  SUSPENDED: "red",
};

export const ONLINE_PAYMENT_METHODS = [
  { value: "BKASH", label: "bKash" },
  { value: "NAGAD", label: "Nagad" },
  { value: "CARD", label: "Debit / credit card" },
  { value: "BANK", label: "Bank transfer" },
] as const satisfies readonly Option[];
export const ONLINE_PAYMENT_METHOD_VALUES = ONLINE_PAYMENT_METHODS.map((m) => m.value);

export const ORDER_PAYMENT_METHODS = [
  ...ONLINE_PAYMENT_METHODS,
  { value: "CASH", label: "Cash on delivery / pickup" },
] as const satisfies readonly Option[];
export const ORDER_PAYMENT_METHOD_VALUES = ORDER_PAYMENT_METHODS.map((m) => m.value);
export const paymentMethodLabel = (value: string | null | undefined) => labelOf(ORDER_PAYMENT_METHODS, value);

export const PAYMENT_STATUS_TONE: Record<string, Tone> = {
  PENDING: "yellow",
  PAID: "green",
  FAILED: "red",
  CANCELLED: "gray",
  REFUNDED: "purple",
};

export const ORDER_STATUSES = [
  { value: "PENDING", label: "Pending confirmation" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "PREPARING", label: "Preparing" },
  { value: "OUT_FOR_DELIVERY", label: "Out for delivery" },
  { value: "READY_FOR_PICKUP", label: "Ready for pickup" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
] as const satisfies readonly Option[];
export type OrderStatusValue = (typeof ORDER_STATUSES)[number]["value"];
export const ORDER_STATUS_VALUES = ORDER_STATUSES.map((s) => s.value);
export const orderStatusLabel = (value: string | null | undefined) => labelOf(ORDER_STATUSES, value);
export const ORDER_STATUS_TONE: Record<string, Tone> = {
  PENDING: "yellow",
  CONFIRMED: "blue",
  PREPARING: "blue",
  OUT_FOR_DELIVERY: "purple",
  READY_FOR_PICKUP: "purple",
  COMPLETED: "green",
  CANCELLED: "gray",
};

export function orderTimeline(fulfillment: string): OrderStatusValue[] {
  return fulfillment === "DELIVERY"
    ? ["PENDING", "CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "COMPLETED"]
    : ["PENDING", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "COMPLETED"];
}

export function nextOrderStatuses(status: string, fulfillment: string): OrderStatusValue[] {
  switch (status) {
    case "PENDING":
      return ["CONFIRMED", "CANCELLED"];
    case "CONFIRMED":
      return ["PREPARING", "CANCELLED"];
    case "PREPARING":
      return [fulfillment === "DELIVERY" ? "OUT_FOR_DELIVERY" : "READY_FOR_PICKUP"];
    case "OUT_FOR_DELIVERY":
    case "READY_FOR_PICKUP":
      return ["COMPLETED"];
    default:
      return [];
  }
}

export const CONTENT_TYPES = [
  { value: "ARTICLE", label: "Health article" },
  { value: "TIP", label: "Health tip" },
  { value: "CAMPAIGN", label: "Campaign" },
  { value: "EVENT", label: "Event" },
  { value: "DONATION_DRIVE", label: "Donation drive" },
  { value: "MEDICINE_INFO", label: "Medicine information" },
  { value: "DONATION_GUIDE", label: "Donation guidance" },
] as const satisfies readonly Option[];
export const CONTENT_TYPE_VALUES = CONTENT_TYPES.map((c) => c.value);
export const contentTypeLabel = (value: string | null | undefined) => labelOf(CONTENT_TYPES, value);

export const LANGUAGES = [
  { value: "EN", label: "English" },
  { value: "BN", label: "বাংলা" },
] as const satisfies readonly Option[];
export const LANGUAGE_VALUES = LANGUAGES.map((l) => l.value);

export const ID_TYPES = [
  { value: "NID", label: "National ID (NID)" },
  { value: "BIRTH_REGISTRATION", label: "Birth registration" },
] as const satisfies readonly Option[];
export const ID_TYPE_VALUES = ID_TYPES.map((t) => t.value);

export const LOCATION_PRECISIONS = [
  { value: "APPROXIMATE", label: "Approximate (area level, about 1 km)" },
  { value: "EXACT", label: "Exact location" },
] as const satisfies readonly Option[];
export const LOCATION_PRECISION_VALUES = LOCATION_PRECISIONS.map((p) => p.value);

export const REPORT_REASONS = [
  "Fake or misleading profile",
  "Harassment or abusive behaviour",
  "Asked for money for blood",
  "Spam",
  "Unsafe or suspicious behaviour",
  "Other",
] as const;

export const NATIONAL_EMERGENCY_NUMBER = "999";
