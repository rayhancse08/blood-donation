import { parseDhakaDate } from "./format";

export class FormError extends Error {}

export type ActionState = { error?: string; success?: string };

function raw(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function reqStr(formData: FormData, name: string, label: string, max = 200): string {
  const value = raw(formData, name);
  if (!value) throw new FormError(`${label} is required.`);
  if (value.length > max) throw new FormError(`${label} must be at most ${max} characters.`);
  return value;
}

export function optStr(formData: FormData, name: string, max = 2000): string | null {
  const value = raw(formData, name);
  if (!value) return null;
  if (value.length > max) throw new FormError(`The "${name}" field must be at most ${max} characters.`);
  return value;
}

export function reqNumber(formData: FormData, name: string, label: string, min: number, max: number): number {
  const value = raw(formData, name);
  const number = Number(value);
  if (!value || !Number.isFinite(number)) throw new FormError(`${label} must be a number.`);
  if (number < min || number > max) throw new FormError(`${label} must be between ${min} and ${max}.`);
  return number;
}

export function reqInt(formData: FormData, name: string, label: string, min: number, max: number): number {
  const number = reqNumber(formData, name, label, min, max);
  if (!Number.isInteger(number)) throw new FormError(`${label} must be a whole number.`);
  return number;
}

export function optInt(formData: FormData, name: string, label: string, min: number, max: number): number | null {
  return raw(formData, name) ? reqInt(formData, name, label, min, max) : null;
}

export function optNumber(formData: FormData, name: string, label: string, min: number, max: number): number | null {
  return raw(formData, name) ? reqNumber(formData, name, label, min, max) : null;
}

export function optCoordinates(formData: FormData): { latitude: number; longitude: number } | null {
  const lat = raw(formData, "latitude");
  const lng = raw(formData, "longitude");
  if (!lat || !lng) return null;
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

export function reqDate(formData: FormData, name: string, label: string): Date {
  const date = parseDhakaDate(raw(formData, name));
  if (!date) throw new FormError(`${label} is required.`);
  return date;
}

export function optDate(formData: FormData, name: string): Date | null {
  return parseDhakaDate(raw(formData, name));
}

export function reqEnum<T extends string>(formData: FormData, name: string, values: readonly T[], label: string): T {
  const value = raw(formData, name);
  if (!values.includes(value as T)) throw new FormError(`Please select a valid ${label.toLowerCase()}.`);
  return value as T;
}

export function optEnum<T extends string>(formData: FormData, name: string, values: readonly T[]): T | null {
  const value = raw(formData, name);
  return values.includes(value as T) ? (value as T) : null;
}

export function bool(formData: FormData, name: string): boolean {
  const value = formData.get(name);
  return value === "on" || value === "true" || value === "1";
}

export function getFile(formData: FormData, name: string): File | null {
  const value = formData.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}

/** Normalises Bangladeshi mobile numbers to +8801XXXXXXXXX. */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const compact = input.replace(/[\s()-]/g, "");
  const match = compact.match(/^(?:\+?88)?(01[3-9]\d{8})$/);
  return match ? `+88${match[1]}` : null;
}

export function reqPhone(formData: FormData, name: string, label: string): string {
  const phone = normalizePhone(reqStr(formData, name, label, 20));
  if (!phone) throw new FormError(`${label} must be a valid Bangladeshi mobile number (e.g. 01712345678).`);
  return phone;
}

export function optPhone(formData: FormData, name: string, label: string): string | null {
  const value = optStr(formData, name, 20);
  if (!value) return null;
  const phone = normalizePhone(value);
  if (!phone) throw new FormError(`${label} must be a valid Bangladeshi mobile number.`);
  return phone;
}

export function normalizeEmail(input: string | null | undefined): string | null {
  const value = input?.trim().toLowerCase() ?? "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254 ? value : null;
}

export function safeNext(value: FormDataEntryValue | string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  return value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : null;
}

export function toFormErrorState(error: unknown): ActionState {
  if (error instanceof FormError) return { error: error.message };
  throw error;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}
