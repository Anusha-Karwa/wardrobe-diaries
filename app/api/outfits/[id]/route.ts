import { NextResponse } from "next/server";
import { deleteOutfit } from "@/lib/queries";

export const runtime = "nodejs";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ok = await deleteOutfit((await params).id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
