import Link from "next/link";
import { buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <p className="text-5xl font-bold text-red-600">404</p>
      <h1 className="mt-4 text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-gray-600">The page you are looking for does not exist or is no longer available.</p>
      <Link href="/" className={`${buttonClass.primary} mt-6`}>
        Go home
      </Link>
    </div>
  );
}
