"use client";

import { buttonClass } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-gray-600">Please try again. If the problem continues, contact support.</p>
      {error.digest && <p className="mt-2 text-xs text-gray-400">Error reference: {error.digest}</p>}
      <button type="button" onClick={reset} className={`${buttonClass.primary} mt-6`}>
        Try again
      </button>
    </div>
  );
}
