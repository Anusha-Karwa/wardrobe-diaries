import { NextResponse } from "next/server";
import { normaliseAttributes } from "@/lib/extraction/attributes";
import { deleteItem, getItem, updateItemAttributes } from "@/lib/queries";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const item = await getItem((await params).id);
  return item ? NextResponse.json(item) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

/** PATCH — any subset of attributes; merged onto the current item, normalised to the taxonomy. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const current = await getItem(id);
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const attrs = normaliseAttributes({ ...current, ...body });
  // Size and brand are free text the user owns.
  if ("size" in body) attrs.size = body.size ? String(body.size).trim().slice(0, 20) : null;
  if ("brand_visible" in body) attrs.brand_visible = body.brand_visible ? String(body.brand_visible).trim().slice(0, 60) : null;
  const updated = await updateItemAttributes(id, attrs);
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const ok = await deleteItem((await params).id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
