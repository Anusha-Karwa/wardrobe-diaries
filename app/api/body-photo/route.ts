import { NextResponse } from "next/server";
import { deleteBodyPhoto, saveBodyPhoto } from "@/lib/try-on";

export const runtime = "nodejs";
export const maxDuration = 60;

/** POST multipart "file": checked for PG-13 (one adult, everyday clothes, full length) before it's stored. */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/")) return NextResponse.json({ error: "No photo received" }, { status: 400 });
  if (file.size > 4.5 * 1024 * 1024) return NextResponse.json({ error: "Photo is too large (max 4.5 MB)" }, { status: 413 });
  try {
    const r = await saveBodyPhoto(Buffer.from(await file.arrayBuffer()));
    return r.ok ? NextResponse.json({ url: r.url }) : NextResponse.json({ error: r.error }, { status: 422 });
  } catch (err) {
    console.error("[body-photo]", err);
    return NextResponse.json({ error: "Couldn't check that photo. Try again." }, { status: 500 });
  }
}

/** DELETE: removes the photo and every try-on image made from it. */
export async function DELETE() {
  await deleteBodyPhoto();
  return NextResponse.json({ ok: true });
}
