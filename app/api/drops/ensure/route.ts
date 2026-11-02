import { NextResponse } from "next/server";
import { createDailyDrop, createWeeklyDrop, getDrop, isoDate, mondayOf, todayIST } from "@/lib/drops";
import { getCurrentTrends, matchCurrentTrends, refreshGroup } from "@/lib/trends";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST {period} → create today's drop (or this week's) on demand if the cron hasn't made it yet,
 * e.g. on the very first visit. Idempotent: returns {created:false} if it already exists.
 */
export async function POST(req: Request) {
  const { period = "daily", force = false } = await req.json().catch(() => ({}));
  const today = todayIST();
  try {
    if (period === "weekly") {
      if (!force && (await getDrop("weekly", isoDate(mondayOf(today))))) return NextResponse.json({ created: false });
      await createWeeklyDrop(today);
      return NextResponse.json({ created: true });
    }
    if (!force && (await getDrop("daily", isoDate(today)))) return NextResponse.json({ created: false });
    // First run ever: get at least one trend group so "trending & missing" isn't empty.
    if (!(await getCurrentTrends()).length) {
      await refreshGroup("tops");
      await matchCurrentTrends();
    }
    await createDailyDrop(today);
    return NextResponse.json({ created: true });
  } catch (err) {
    console.error("[drops] ensure failed", err);
    return NextResponse.json({ error: "Couldn't prepare the drop" }, { status: 500 });
  }
}
