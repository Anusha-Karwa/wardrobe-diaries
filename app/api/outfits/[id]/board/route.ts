import { putBlob } from "@/lib/blob";
import { renderBoard } from "@/lib/board";
import { getItemsByIds, getOutfit, setOutfitBoard } from "@/lib/queries";

export const runtime = "nodejs";
export const maxDuration = 60;

/** GET → the saved outfit's board PNG as a download (renders it first if it's missing). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const outfit = await getOutfit((await params).id);
  if (!outfit) return new Response("Not found", { status: 404 });
  let png: Buffer;
  if (outfit.board_url) {
    png = Buffer.from(await (await fetch(outfit.board_url)).arrayBuffer());
  } else {
    const items = await getItemsByIds(outfit.item_ids);
    const ordered = outfit.item_ids.map((id) => items.find((i) => i.id === id)).filter((i) => !!i);
    png = await renderBoard({ ...outfit, items: ordered });
    await setOutfitBoard(outfit.id, await putBlob(`boards/${outfit.id}.png`, png, "image/png"));
  }
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${slug(outfit.name ?? "outfit")}.png"`,
    },
  });
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "outfit";
