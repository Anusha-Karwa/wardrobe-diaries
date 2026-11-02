import { NextResponse } from "next/server";
import { deleteBlobs, putBlob } from "@/lib/blob";
import { finishCutout } from "@/lib/extraction/cutout";
import { getItem, setItemCutout } from "@/lib/queries";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST multipart "file" (PNG from browser background removal) → trim/pad → cutout_method browser_bg_removal.
 * POST JSON {"method":"crop_only"} → use the rectangle crop instead.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const item = await getItem(id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (req.headers.get("content-type")?.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    if (body?.method !== "crop_only") return NextResponse.json({ error: "Unknown method" }, { status: 400 });
    const updated = await setItemCutout(id, null, "crop_only");
    await deleteBlobs([item.cutout_url]);
    return NextResponse.json(updated);
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No image received" }, { status: 400 });
  if (file.size > 4.5 * 1024 * 1024) return NextResponse.json({ error: "Image too large" }, { status: 413 });

  const finished = await finishCutout(Buffer.from(await file.arrayBuffer())).catch(() => null);
  if (!finished) return NextResponse.json({ error: "The cutout came back empty" }, { status: 422 });

  // New file name each time so browsers/CDN never show a stale cutout.
  const url = await putBlob(`items/${id}-${Date.now()}.png`, finished, "image/png");
  // A cleaned-up online match keeps its "Online match" badge.
  const method = form?.get("method") === "online_match" && item.cutout_method === "online_match" ? "online_match" : "browser_bg_removal";
  const updated = await setItemCutout(id, url, method);
  if (item.cutout_url && item.cutout_url !== url) await deleteBlobs([item.cutout_url]);
  return NextResponse.json(updated);
}
