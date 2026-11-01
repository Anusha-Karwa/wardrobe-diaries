import { NextResponse } from "next/server";
import { getUpload } from "@/lib/queries";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const up = await getUpload((await params).id);
  return up ? NextResponse.json(up) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
