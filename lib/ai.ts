import type { FacilityType, User } from "@/generated/prisma/client";
import { compatibleDonorGroups } from "./blood";
import { bloodGroupLabel, facilityTypeLabel, type BloodGroupValue } from "./constants";
import { db } from "./db";
import { visibleDonorWhere } from "./donors";

export const AI_DISCLAIMER =
  "The assistant gives general health information only. It is not a diagnosis or prescription. Always consult a qualified doctor.";

const SYSTEM_PROMPT = `You are "Blood App Assistant", a helpful assistant inside a Bangladeshi blood donation and healthcare app.
You help users: find blood donors and blood requests, find nearby hospitals, clinics, diagnostic centers, doctors, pharmacies and ambulances, understand medicines and general health topics, learn about blood donation, and use the app.

Rules:
- Reply in the same language the user writes in (Bangla or English). Keep answers short, clear and practical.
- Give general information only. Never diagnose, never prescribe medicine or doses for a specific person. Encourage consulting a qualified doctor.
- If the situation sounds like an emergency, tell the user to press the red Emergency button in the app (/emergency), call an ambulance or the national emergency number 999, or go to the nearest hospital immediately.
- Use the "App data" provided to you when it is relevant. Do not invent donors, hospitals, doctors, phone numbers or prices.
- Useful app pages: /map (live donor map), /requests/new (post a blood request), /emergency, /directory (hospitals, doctors, ambulances), /pharmacy (buy medicine), /donations (donation history & rewards), /awareness (health articles).`;

const EMERGENCY_PATTERNS = [
  /emergenc/i,
  /unconscious/i,
  /not breathing|can't breathe|cannot breathe|difficulty breathing/i,
  /heavy bleeding|severe bleeding/i,
  /chest pain/i,
  /accident/i,
  /stroke|seizure|heart attack/i,
  /suicid/i,
  /জরুরি/,
  /দুর্ঘটনা/,
  /রক্তক্ষরণ/,
  /অজ্ঞান/,
  /শ্বাসকষ্ট/,
  /বুকে ব্যথা/,
];

export function isEmergencyMessage(text: string) {
  return EMERGENCY_PATTERNS.some((pattern) => pattern.test(text));
}

const FACILITY_KEYWORDS: [FacilityType, RegExp][] = [
  ["HOSPITAL", /hospital|হাসপাতাল/i],
  ["CLINIC", /clinic|ক্লিনিক/i],
  ["DIAGNOSTIC_CENTER", /diagnostic|lab test|ডায়াগনস্টিক/i],
  ["PHARMACY", /pharmac|medicine shop|drug store|ফার্মেসি|ওষুধের দোকান/i],
  ["AMBULANCE", /ambulance|অ্যাম্বুলেন্স|এম্বুলেন্স/i],
  ["BLOOD_BANK", /blood bank|ব্লাড ব্যাংক/i],
  ["DONATION_CENTER", /donation cent/i],
];

function detectBloodGroup(text: string): BloodGroupValue | null {
  const match = text.match(/\b(AB|A|B|O)\s*(\+|-|−|positive|negative|pos|neg|\(\+\)|\(-\))/i);
  if (!match) return null;
  const sign = /\+|pos/i.test(match[2]!) ? "POS" : "NEG";
  return `${match[1]!.toUpperCase()}_${sign}` as BloodGroupValue;
}

export async function buildAppContext(user: User, text: string) {
  const parts: string[] = [];
  const district = user.district;
  const now = new Date();

  const group = detectBloodGroup(text);
  if (group || /donor|blood|রক্ত|ডোনার|দাতা/i.test(text)) {
    const target = group ?? (user.bloodGroup as BloodGroupValue | null);
    if (target) {
      const [donorCount, openRequests] = await Promise.all([
        db.user.count({
          where: {
            ...visibleDonorWhere(now),
            bloodGroup: { in: compatibleDonorGroups(target) },
            ...(district ? { district } : {}),
          },
        }),
        db.bloodRequest.count({
          where: { status: { in: ["OPEN", "ACCEPTED"] }, bloodGroup: target, ...(district ? { district } : {}) },
        }),
      ]);
      parts.push(
        `Available donors compatible with ${bloodGroupLabel(target)}${district ? ` in ${district}` : ""}: ${donorCount}. Open ${bloodGroupLabel(target)} requests${district ? ` in ${district}` : ""}: ${openRequests}. Users can see donors on /map and post a request at /requests/new.`,
      );
    }
  }

  for (const [type, pattern] of FACILITY_KEYWORDS) {
    if (!pattern.test(text)) continue;
    const facilities = await db.facility.findMany({
      where: { type, isActive: true, ...(district ? { district } : {}) },
      select: { name: true, phone: true, address: true, district: true, is24Hours: true },
      take: 5,
    });
    if (facilities.length) {
      parts.push(
        `${facilityTypeLabel(type)} listings${district ? ` in ${district}` : ""}:\n` +
          facilities
            .map((f) => `- ${f.name}${f.is24Hours ? " (24h)" : ""}, ${f.address ?? f.district ?? ""}${f.phone ? `, phone ${f.phone}` : ""}`)
            .join("\n"),
      );
    }
  }

  if (/doctor|specialist|ডাক্তার|চিকিৎসক|বিশেষজ্ঞ/i.test(text)) {
    const doctors = await db.doctor.findMany({
      where: { isActive: true, ...(district ? { district } : {}) },
      select: { name: true, speciality: true, chamberName: true, visitingHours: true },
      take: 5,
    });
    if (doctors.length) {
      parts.push(
        "Doctors listed in the app:\n" +
          doctors
            .map((d) => `- ${d.name} (${d.speciality})${d.chamberName ? `, chamber: ${d.chamberName}` : ""}${d.visitingHours ? `, ${d.visitingHours}` : ""}`)
            .join("\n"),
      );
    }
  }

  const words = [...new Set(text.match(/[a-zA-Z]{4,}/g) ?? [])].slice(0, 6);
  if (words.length) {
    const medicines = await db.medicine.findMany({
      where: {
        OR: words.flatMap((w) => [
          { name: { contains: w, mode: "insensitive" as const } },
          { genericName: { contains: w, mode: "insensitive" as const } },
        ]),
      },
      select: { name: true, genericName: true, strength: true, usage: true, sideEffects: true, requiresPrescription: true },
      take: 3,
    });
    for (const m of medicines) {
      parts.push(
        `Medicine: ${m.name}${m.strength ? ` ${m.strength}` : ""}${m.genericName ? ` (generic: ${m.genericName})` : ""}. ${m.usage ? `Common use: ${m.usage}. ` : ""}${m.sideEffects ? `Possible side effects: ${m.sideEffects}. ` : ""}${m.requiresPrescription ? "Prescription required." : "Available without prescription."} Users can order it at /pharmacy.`,
      );
    }
  }

  return parts.join("\n\n");
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

function offlineReply(question: string, context: string, emergency: boolean) {
  const lines: string[] = [];
  if (emergency) {
    lines.push(
      "This sounds like it could be an emergency. Please press the red Emergency button (/emergency), call 999 or an ambulance, or go to the nearest hospital right away.",
    );
  }
  if (context) {
    lines.push("Here is what I found in the app:", context);
  } else {
    lines.push(
      "I can help you find donors (/map), post a blood request (/requests/new), find hospitals, doctors and ambulances (/directory), order medicine (/pharmacy) and read health articles (/awareness).",
      `You asked: "${question.slice(0, 200)}". Try mentioning a blood group (e.g. "B+ donor"), a facility type (e.g. "hospital", "ambulance") or a medicine name.`,
    );
  }
  lines.push(AI_DISCLAIMER);
  return lines.join("\n\n");
}

export async function generateAssistantReply(history: ChatTurn[], context: string, emergency: boolean) {
  const lastQuestion = [...history].reverse().find((turn) => turn.role === "user")?.content ?? "";
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) return offlineReply(lastQuestion, context, emergency);

  try {
    const response = await fetch(`${(process.env.AI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.AI_MODEL ?? "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 700,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "system",
            content: `App data:\n${context || "(no matching app data)"}${emergency ? "\n\nThe latest message may describe an emergency. Start your reply with emergency guidance." : ""}`,
          },
          ...history,
        ],
      }),
    });
    if (!response.ok) return offlineReply(lastQuestion, context, emergency);
    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content?.trim() || offlineReply(lastQuestion, context, emergency);
  } catch {
    return offlineReply(lastQuestion, context, emergency);
  }
}
