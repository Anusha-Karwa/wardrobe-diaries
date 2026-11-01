import { NextResponse } from "next/server";
import { z } from "zod";
import { generateOutfits } from "@/lib/outfits";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  mode: z.enum(["anchor", "occasion"]),
  anchorItemId: z.string().uuid().optional(),
  occasion: z.string().max(60).optional(),
  weather: z.string().max(60).optional(),
  vibe: z.string().max(120).optional(),
  count: z.number().int().min(1).max(6).optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (parsed.data.mode === "anchor" && !parsed.data.anchorItemId)
    return NextResponse.json({ error: "Pick an item to style" }, { status: 400 });
  try {
    return NextResponse.json(await generateOutfits(parsed.data));
  } catch (err) {
    console.error("[outfits] generate failed", err);
    const msg = (err as Error).message ?? "";
    return NextResponse.json(
      { error: /429|quota|rate/i.test(msg) ? "Gemini is rate-limiting us. Try again in a minute." : "Couldn't build outfits right now. Try again." },
      { status: 500 }
    );
  }
}
