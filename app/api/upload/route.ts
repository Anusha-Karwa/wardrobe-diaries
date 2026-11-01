import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/extraction/pipeline";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 4.5 * 1024 * 1024;

/** POST /api/upload — one photo per request (multipart field "file"). */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No photo received" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Photo is too large (max 4.5 MB)" }, { status: 413 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "That isn't an image" }, { status: 400 });

  try {
    const result = await runPipeline(Buffer.from(await file.arrayBuffer()));
    return NextResponse.json(result);
  } catch (err) {
    console.error("[upload] pipeline failed", err);
    const msg = (err as Error).message ?? "";
    const friendly = /429|quota|rate/i.test(msg)
      ? "Gemini is rate-limiting us. Wait a minute and try again."
      : "Couldn't analyse this photo. Try again or use a different photo.";
    return NextResponse.json({ error: friendly, detail: msg.slice(0, 300) }, { status: 500 });
  }
}
