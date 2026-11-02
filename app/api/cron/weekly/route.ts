import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { runWeeklyCron } from "@/lib/drops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Monday 03:00 UTC = 8:30 am IST: full trend refresh (4 groups at a time) + the weekly drop. */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await runWeeklyCron()) });
  } catch (err) {
    console.error("[cron:weekly] failed", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
