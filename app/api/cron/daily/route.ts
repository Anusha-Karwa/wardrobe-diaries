import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { runDailyCron } from "@/lib/drops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** 02:30 UTC = 8:00 am IST: re-match trends to the wardrobe and build today's drop (trends themselves refresh weekly). */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await runDailyCron()) });
  } catch (err) {
    console.error("[cron:daily] failed", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
