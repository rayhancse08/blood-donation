import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PUBLIC_UPLOAD_CATEGORIES, readUpload, type UploadCategory } from "@/lib/storage";

async function canAccess(segments: string[], key: string) {
  const [category, ownerId] = segments as [UploadCategory, string | undefined];
  if (PUBLIC_UPLOAD_CATEGORIES.includes(category)) return true;

  const user = await getCurrentUser();
  if (!user) return false;
  if (user.role === "ADMIN" || user.id === ownerId) return true;

  if (category === "prescriptions") {
    const order = await db.order.findFirst({
      where: { prescriptionKey: key, pharmacy: { ownerId: user.id } },
      select: { id: true },
    });
    return !!order;
  }
  if (category === "licenses") {
    const facility = await db.facility.findFirst({ where: { licenseDocKey: key, ownerId: user.id }, select: { id: true } });
    return !!facility;
  }
  return false;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: segments } = await params;
  if (segments.length < 3 || segments.some((s) => s === ".." || s === "." || s.includes("\\"))) {
    return new Response("Not found", { status: 404 });
  }
  const key = segments.join("/");

  if (!(await canAccess(segments, key))) return new Response("Not found", { status: 404 });

  const file = await readUpload(key);
  if (!file) return new Response("Not found", { status: 404 });

  const isPublic = PUBLIC_UPLOAD_CATEGORIES.includes(segments[0] as UploadCategory);
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": isPublic ? "public, max-age=31536000, immutable" : "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `inline; filename="${segments.at(-1)}"`,
    },
  });
}
