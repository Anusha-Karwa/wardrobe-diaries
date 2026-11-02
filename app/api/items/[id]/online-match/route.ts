import { NextResponse } from "next/server";
import { z } from "zod";
import { getOnlineMatches, onlineMatchEnabled, applyOnlineMatch } from "@/lib/online-match";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({ action: z.enum(["search", "use"]).default("search"), refresh: z.boolean().optional(), index: z.number().int().min(0).max(9).optional() });

/**
 * POST {action:"search", refresh?} → Google Lens similar products for this item (cached on the item)
 * POST {action:"use", index}       → make match #index the item's picture
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!onlineMatchEnabled()) return NextResponse.json({ error: "Online matching isn't set up (SERPAPI_KEY missing)." }, { status: 501 });
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try {
    if (parsed.data.action === "use") {
      if (parsed.data.index === undefined) return NextResponse.json({ error: "Pick a match" }, { status: 400 });
      return NextResponse.json(await applyOnlineMatch(id, parsed.data.index));
    }
    const r = await getOnlineMatches(id, parsed.data.refresh);
    return NextResponse.json({ matches: r.matches, cached: r.cached });
  } catch (err) {
    const msg = (err as Error).message ?? "";
    console.error("[online-match]", msg);
    const friendly = /run out|limit|429|quota/i.test(msg)
      ? "This month's free Google Lens searches are used up."
      : /download/i.test(msg)
        ? msg
        : "Couldn't search for similar items right now.";
    return NextResponse.json({ error: friendly }, { status: 500 });
  }
}
