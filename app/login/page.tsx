import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { getCurrentUser } from "@/lib/auth";
import { safeNext } from "@/lib/form";
import { one } from "@/lib/format";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  google_not_configured: "Google sign-in is not configured yet. Please use your phone or email.",
  google_failed: "Google sign-in failed. Please try again.",
  link_invalid: "That sign-in link is invalid or has expired. Please request a new code.",
  suspended: "This account has been suspended. Please contact support.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeNext(one(params.next)) ?? undefined;
  const user = await getCurrentUser();
  if (user) redirect(user.profileCompleted ? (next ?? "/dashboard") : "/onboarding");

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold">Welcome to Blood App</h1>
        <p className="mb-6 mt-1 text-sm text-gray-600">
          Sign in or create an account. New users start as a receiver and can become a donor anytime.
        </p>
        <LoginForm next={next} error={ERRORS[one(params.error)]} />
        <p className="mt-6 text-xs text-gray-500">
          By continuing you agree to share your name and blood group publicly. Your contact details are only shared after
          you accept a request.
        </p>
      </div>
    </div>
  );
}
