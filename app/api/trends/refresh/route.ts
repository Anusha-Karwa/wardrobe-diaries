import { NextResponse } from "next/server";
import { z } from "zod";
import { CATEGORY_GROUPS, matchCurrentTrends, refreshAll, refreshGroup, type GroupKey } from "@/lib/trends";

export const runtime = "nodejs";
// Fluid compute allows up to 300s; the page still calls one group per request so it can show progress.
export const maxDuration = 300;

const Body = z.object({
  group: z.enum(CATEGORY_GROUPS.map((g) => g.key) as [GroupKey, ...GroupKey[]]).optional(),
  batchId: z.string().uuid().optional(),
  step: z.enum(["match"]).optional(),
  period: z.enum(["daily", "weekly"]).optional(),
});

/**
 * POST {group, batchId?}  → research + structure + save one category group
 * POST {step: "match"}    → match all current trends against the wardrobe
 * POST {}                 → everything (all groups, then match)
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { group, batchId, step, period } = parsed.data;
  try {
    if (step === "match") return NextResponse.json(await matchCurrentTrends());
    if (group) return NextResponse.json(await refreshGroup(group, { batchId, period }));
    return NextResponse.json(await refreshAll(undefined, period));
  } catch (err) {
    console.error("[trends] refresh failed", err);
    const msg = (err as Error).message ?? "";
    return NextResponse.json(
      { error: /429|quota|rate/i.test(msg) ? "Gemini or Google Search is rate-limiting us. Try again in a minute." : "Trend refresh failed. Try again." },
      { status: 500 }
    );
  }
}
