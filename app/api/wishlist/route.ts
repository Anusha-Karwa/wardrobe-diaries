import { NextResponse } from "next/server";
import { z } from "zod";
import { addToWishlist, listWishlist } from "@/lib/queries";

export const runtime = "nodejs";

const Card = z.object({
  title: z.string().trim().min(1).max(160),
  category: z.string().max(40),
  attributes: z.record(z.string(), z.string()).default({}),
  why: z.string().max(1000).default(""),
  pairs_with_item_ids: z.array(z.string().uuid()).max(20).default([]),
  search_query: z.string().max(160),
  links: z.object({ myntra: z.string(), ajio: z.string(), nykaa: z.string(), amazon: z.string() }),
  price_band: z.string().max(60).default(""),
  trend: z.object({ id: z.string().uuid(), title: z.string(), heat: z.number(), sources: z.array(z.any()) }).nullable().default(null),
});

export async function GET() {
  return NextResponse.json(await listWishlist());
}

export async function POST(req: Request) {
  const parsed = Card.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid suggestion" }, { status: 400 });
  return NextResponse.json(await addToWishlist(parsed.data));
}
