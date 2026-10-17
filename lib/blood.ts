import { BLOOD_GROUP_VALUES, type BloodGroupValue } from "./constants";

/** Recipient blood group -> donor groups that can safely give red cells to that recipient. */
const COMPATIBLE_DONORS: Record<BloodGroupValue, BloodGroupValue[]> = {
  O_NEG: ["O_NEG"],
  O_POS: ["O_POS", "O_NEG"],
  A_NEG: ["A_NEG", "O_NEG"],
  A_POS: ["A_POS", "A_NEG", "O_POS", "O_NEG"],
  B_NEG: ["B_NEG", "O_NEG"],
  B_POS: ["B_POS", "B_NEG", "O_POS", "O_NEG"],
  AB_NEG: ["AB_NEG", "A_NEG", "B_NEG", "O_NEG"],
  AB_POS: [...BLOOD_GROUP_VALUES],
};

export function isBloodGroup(value: unknown): value is BloodGroupValue {
  return typeof value === "string" && (BLOOD_GROUP_VALUES as string[]).includes(value);
}

export function compatibleDonorGroups(recipient: BloodGroupValue): BloodGroupValue[] {
  return COMPATIBLE_DONORS[recipient];
}

export function canDonateTo(donor: BloodGroupValue, recipient: BloodGroupValue) {
  return COMPATIBLE_DONORS[recipient].includes(donor);
}

/** Recipient groups a donor with the given blood group can give to. */
export function recipientGroupsFor(donor: BloodGroupValue): BloodGroupValue[] {
  return BLOOD_GROUP_VALUES.filter((recipient) => COMPATIBLE_DONORS[recipient].includes(donor));
}
