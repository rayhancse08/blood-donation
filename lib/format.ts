const TIME_ZONE = "Asia/Dhaka";
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: TIME_ZONE,
});
const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});
const timeFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });

type DateLike = Date | string | null | undefined;

export function formatDate(value: DateLike) {
  return value ? dateFormat.format(new Date(value)) : "—";
}

export function formatDateTime(value: DateLike) {
  return value ? dateTimeFormat.format(new Date(value)) : "—";
}

export function formatTime(value: DateLike) {
  return value ? timeFormat.format(new Date(value)) : "";
}

export function ageFrom(dateOfBirth: DateLike, now: Date): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < dob.getUTCMonth() ||
    (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/** Value for <input type="date"> in Bangladesh time. */
export function toDateInputValue(value: DateLike) {
  if (!value) return "";
  return new Date(new Date(value).getTime() + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Value for <input type="datetime-local"> in Bangladesh time. */
export function toDateTimeInputValue(value: DateLike) {
  if (!value) return "";
  return new Date(new Date(value).getTime() + DHAKA_OFFSET_MS).toISOString().slice(0, 16);
}

/** Parses a date / datetime-local form value, interpreting it as Bangladesh time. */
export function parseDhakaDate(value: string): Date | null {
  if (!value) return null;
  let iso = value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) iso = `${value}T00:00:00+06:00`;
  else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) iso = `${value}:00+06:00`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function daysUntil(target: Date, now: Date) {
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
}

export function timeAgo(value: DateLike, now: Date) {
  if (!value) return "";
  const seconds = Math.round((now.getTime() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return formatDate(value);
}

export function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}
