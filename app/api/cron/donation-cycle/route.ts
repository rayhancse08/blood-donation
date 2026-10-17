import { NextResponse, type NextRequest } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { releaseExpiredCooldowns } from "@/lib/donation-cycle";

/** Call daily (e.g. from a cron job) with `Authorization: Bearer <CRON_SECRET>`. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(header, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const released = await releaseExpiredCooldowns();
  return NextResponse.json({ released });
}
