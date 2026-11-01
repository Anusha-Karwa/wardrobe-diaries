import { renderBoard } from "@/lib/board";
import { OutfitInput } from "@/lib/outfit-input";
import { getItemsByIds } from "@/lib/queries";

export const runtime = "nodejs";
export const maxDuration = 60;

/** POST an unsaved outfit → its board PNG (for Download / Share without saving). */
export async function POST(req: Request) {
  const parsed = OutfitInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return new Response("Invalid outfit", { status: 400 });
  const items = await getItemsByIds(parsed.data.item_ids);
  const ordered = parsed.data.item_ids.map((id) => items.find((i) => i.id === id)).filter((i) => !!i);
  const png = await renderBoard({ ...parsed.data, items: ordered });
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png" } });
}
