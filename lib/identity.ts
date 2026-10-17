/**
 * Automatic NID / birth registration verification (Phase 2).
 * Returns null when no verification provider is configured, so the request
 * falls back to manual review by an admin.
 */
export async function verifyIdentityAutomatically(input: {
  idType: "NID" | "BIRTH_REGISTRATION";
  idNumber: string;
  name: string | null;
  dateOfBirth: Date | null;
}): Promise<"VERIFIED" | "REJECTED" | null> {
  const url = process.env.IDENTITY_VERIFY_URL;
  if (!url) return null;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.IDENTITY_VERIFY_KEY ?? ""}`,
      },
      body: JSON.stringify({
        type: input.idType,
        number: input.idNumber,
        name: input.name,
        dateOfBirth: input.dateOfBirth?.toISOString().slice(0, 10) ?? null,
      }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { verified?: boolean };
    if (data.verified === true) return "VERIFIED";
    if (data.verified === false) return "REJECTED";
    return null;
  } catch {
    return null;
  }
}

export function validateIdNumber(idType: "NID" | "BIRTH_REGISTRATION", value: string) {
  const digits = value.replace(/\D/g, "");
  if (idType === "NID") return [10, 13, 17].includes(digits.length) ? digits : null;
  return digits.length === 17 ? digits : null;
}
