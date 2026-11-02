import { NextResponse } from "next/server";
import { z } from "zod";
import { tryOn, TryOnError } from "@/lib/try-on";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({ item_ids: z.array(z.string().uuid()).min(1).max(6), force: z.boolean().optional() });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Pick 1–6 pieces to try on" }, { status: 400 });
  try {
    return NextResponse.json(await tryOn(parsed.data.item_ids, { force: parsed.data.force }));
  } catch (err) {
    if (err instanceof TryOnError) return NextResponse.json({ error: err.message }, { status: 422 });
    console.error("[try-on]", err);
    const msg = (err as Error).message ?? "";
    return NextResponse.json(
      { error: /429|quota|rate/i.test(msg) ? "Gemini is rate-limiting us. Try again in a minute." : "Couldn't generate the try-on. Try again." },
      { status: 500 }
    );
  }
}
