import Link from "next/link";
import type { ReactNode } from "react";
import { BLOOD_GROUPS, bloodGroupLabel, type Option, type Tone } from "@/lib/constants";

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100 disabled:bg-gray-100";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";

export const buttonClass = {
  primary: `${buttonBase} bg-red-600 text-white hover:bg-red-700`,
  secondary: `${buttonBase} border border-gray-300 bg-white text-gray-800 hover:bg-gray-50`,
  dark: `${buttonBase} bg-gray-900 text-white hover:bg-gray-800`,
  success: `${buttonBase} bg-green-600 text-white hover:bg-green-700`,
  danger: `${buttonBase} border border-red-200 bg-red-50 text-red-700 hover:bg-red-100`,
  ghost: `${buttonBase} text-gray-700 hover:bg-gray-100`,
  small: "inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50",
};

export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 py-8", className)}>{children}</div>;
}

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  children,
  className,
  title,
  actions,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className={cn("rounded-xl border border-gray-200 bg-white p-5 shadow-sm", className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold text-gray-900">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

const toneClasses: Record<Tone, string> = {
  red: "bg-red-50 text-red-700 ring-red-200",
  green: "bg-green-50 text-green-700 ring-green-200",
  yellow: "bg-yellow-50 text-yellow-800 ring-yellow-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  gray: "bg-gray-100 text-gray-700 ring-gray-200",
  purple: "bg-purple-50 text-purple-700 ring-purple-200",
  orange: "bg-orange-50 text-orange-700 ring-orange-200",
};

export function Badge({ children, tone = "gray" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", toneClasses[tone])}>
      {children}
    </span>
  );
}

export function BloodGroupBadge({ group, size = "md" }: { group: string | null | undefined; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "h-8 w-8 text-xs", md: "h-11 w-11 text-sm", lg: "h-16 w-16 text-xl" };
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-red-600 font-bold text-white", sizes[size])}>
      {bloodGroupLabel(group)}
    </span>
  );
}

const alertClasses = {
  info: "border-blue-200 bg-blue-50 text-blue-800",
  success: "border-green-200 bg-green-50 text-green-800",
  warning: "border-yellow-200 bg-yellow-50 text-yellow-900",
  error: "border-red-200 bg-red-50 text-red-800",
};

export function Alert({ children, tone = "info" }: { children: ReactNode; tone?: keyof typeof alertClasses }) {
  return <div className={cn("rounded-lg border px-4 py-3 text-sm", alertClasses[tone])}>{children}</div>;
}

export function FormMessage({ state }: { state: { error?: string; success?: string } }) {
  if (state.error) return <Alert tone="error">{state.error}</Alert>;
  if (state.success) return <Alert tone="success">{state.success}</Alert>;
  return null;
}

export function Field({
  label,
  children,
  hint,
  required,
  className,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

export function SelectOptions({ options, placeholder }: { options: readonly Option[]; placeholder?: string }) {
  return (
    <>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </>
  );
}

export function BloodGroupSelect({
  name = "bloodGroup",
  defaultValue,
  required,
  placeholder = "Select blood group",
}: {
  name?: string;
  defaultValue?: string | null;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <select name={name} defaultValue={defaultValue ?? ""} required={required} className={inputClass}>
      <SelectOptions options={BLOOD_GROUPS} placeholder={placeholder} />
    </select>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
      <p className="font-semibold text-gray-900">{title}</p>
      {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, href }: { label: string; value: ReactNode; hint?: ReactNode; href?: string }) {
  const body = (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block transition hover:-translate-y-0.5">
      {body}
    </Link>
  ) : (
    body
  );
}

export function Avatar({ name, src, size = 40 }: { name: string | null | undefined; src?: string | null; size?: number }) {
  const initials = (name ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name ?? "User"} width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-red-100 font-semibold text-red-700"
      style={{ width: size, height: size, fontSize: size / 2.8 }}
    >
      {initials || "?"}
    </span>
  );
}

export function Tabs({ items, active }: { items: { href: string; label: string; key: string }[]; active: string }) {
  return (
    <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-200 pb-2">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm font-medium",
            item.key === active ? "bg-red-600 text-white" : "text-gray-700 hover:bg-gray-100",
          )}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-gray-100 py-2 text-sm last:border-0">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right font-medium text-gray-900">{children}</dd>
    </div>
  );
}
