import { NextResponse } from "next/server";
import { deleteWishlistItem, setWishlistBought } from "@/lib/queries";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const body = await req.json().catch(() => ({}));
  const item = await setWishlistBought((await params).id, !!body?.bought);
  return item ? NextResponse.json(item) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return (await deleteWishlistItem((await params).id))
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "Not found" }, { status: 404 });
}
