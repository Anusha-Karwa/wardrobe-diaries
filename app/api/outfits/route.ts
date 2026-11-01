import { NextResponse } from "next/server";
import { putBlob } from "@/lib/blob";
import { renderBoard } from "@/lib/board";
import { OutfitInput } from "@/lib/outfit-input";
import { getItemsByIds, insertOutfit, listLookbook, setOutfitBoard } from "@/lib/queries";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  return NextResponse.json(await listLookbook());
}

/** Save an outfit to the Lookbook and render its board PNG. */
export async function POST(req: Request) {
  const parsed = OutfitInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid outfit" }, { status: 400 });
  const o = parsed.data;
  const items = await getItemsByIds(o.item_ids);
  if (items.length !== o.item_ids.length) return NextResponse.json({ error: "Some items no longer exist" }, { status: 400 });
  const ordered = o.item_ids.map((id) => items.find((i) => i.id === id)!);

  const outfit = await insertOutfit({ ...o, occasion: o.occasion ?? null, missing_piece: o.missing_piece ?? null });
  try {
    const png = await renderBoard({ name: o.name, style_tag: o.style_tag, color_story: o.color_story, items: ordered });
    const url = await putBlob(`boards/${outfit.id}.png`, png, "image/png");
    await setOutfitBoard(outfit.id, url);
    outfit.board_url = url;
  } catch (err) {
    // The outfit is saved even if the board fails; it can be rendered again on download.
    console.error("[outfits] board render failed", err);
  }
  return NextResponse.json(outfit);
}
