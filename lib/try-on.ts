import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { deleteBlobs, putBlob } from "./blob";
import { sql } from "./db";
import { gemini, generateJson } from "./gemini";
import { GEMINI_IMAGE_MODEL } from "./extraction/product-shot";
import { getItemsByIds, getProfile } from "./queries";
import type { Item } from "./types";
import { labelize } from "./utils";

/**
 * Virtual fitting room: the user's own full-body photo, dressed in pieces from their wardrobe by Gemini's image model.
 * PG-13 by design: the uploaded photo is checked before it's stored, the prompt requires full modest coverage,
 * and every generated image is checked again before it's saved.
 */

// ---------------------------------------------------------------------------
// Safety check (used for the upload AND for every generated image)
// ---------------------------------------------------------------------------
const Check = z.object({
  person_count: z.number(),
  appears_adult: z.boolean(),
  full_body_visible: z.boolean(),
  clothing: z.enum(["regular_clothes", "swimwear_or_underwear", "partial_or_nude", "unclear"]),
  explicit_or_suggestive: z.boolean(),
  reason: z.string(),
});
export type PhotoCheck = z.infer<typeof Check>;

async function checkPhoto(jpeg: Buffer, purpose: "upload" | "result") {
  return generateJson(
    Check,
    {
      contents: [
        { inlineData: { mimeType: "image/jpeg", data: jpeg.toString("base64") } },
        `Safety check for a fashion try-on app (PG-13). Look at the photo and report:
- person_count: number of people visible
- appears_adult: does the person appear to be 18 or older?
- full_body_visible: is the person visible from head to at least the knees (ideally to the feet)?
- clothing: "regular_clothes" (everyday clothes covering torso and hips), "swimwear_or_underwear", "partial_or_nude", or "unclear"
- explicit_or_suggestive: any nudity, see-through clothing, sexualised pose or content?
- reason: one short sentence.
Return JSON.`,
      ],
      config: { temperature: 0 },
    },
    { label: `tryon:check:${purpose}`, timeoutMs: 30_000, thinkingLevel: "LOW" }
  );
}

function uploadVerdict(c: PhotoCheck): string | null {
  if (c.person_count !== 1) return "Please use a photo with just you in it.";
  if (!c.appears_adult) return "The fitting room is for adults only.";
  if (c.clothing !== "regular_clothes" || c.explicit_or_suggestive)
    return "Please use a photo in everyday clothes (for example a t-shirt and jeans). Swimwear, underwear or revealing photos can't be used.";
  if (!c.full_body_visible) return "Please use a full-length photo (head to feet), standing and facing the camera.";
  return null;
}

// ---------------------------------------------------------------------------
// Body photo
// ---------------------------------------------------------------------------
export async function saveBodyPhoto(file: Buffer) {
  const jpeg = await sharp(file).rotate().resize(1536, 1536, { fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 90 }).toBuffer();
  const check = await checkPhoto(jpeg, "upload");
  const problem = uploadVerdict(check);
  if (problem) return { ok: false as const, error: problem };

  // Unguessable path; replacing the photo deletes the old one and every try-on made from it.
  const url = await putBlob(`bodies/${randomUUID()}.jpg`, jpeg, "image/jpeg");
  const old = (await getProfile()).body_photo_url;
  await sql`update profile set body_photo_url = ${url}, updated_at = now() where id = 1`;
  if (old) await deleteBlobs([old]);
  await clearTryOns();
  return { ok: true as const, url };
}

export async function deleteBodyPhoto() {
  const old = (await getProfile()).body_photo_url;
  await sql`update profile set body_photo_url = null, updated_at = now() where id = 1`;
  await deleteBlobs([old]);
  await clearTryOns();
}

async function clearTryOns() {
  const rows = await sql`delete from try_ons returning image_url`;
  await deleteBlobs(rows.map((r) => r.image_url as string));
}

// ---------------------------------------------------------------------------
// Try-on
// ---------------------------------------------------------------------------
const ORDER = ["dress", "ethnic_set", "topwear", "outerwear", "bottomwear", "footwear", "bag", "jewellery", "accessory", "innerwear_activewear"];

function promptFor(items: Item[]) {
  const list = items.map((it, i) => `IMAGE ${i + 2}: ${labelize(it.category)} / ${labelize(it.subcategory)} — ${it.description}`).join("\n");
  const hasShoes = items.some((i) => i.category === "footwear");
  return `Virtual try-on for a fashion app.
IMAGE 1 is the user. The other images are clothing items from their own wardrobe:
${list}

Create ONE photorealistic full-length fashion photo of the SAME person from IMAGE 1 wearing exactly these items together as one outfit.
- Keep the person identical: same face and facial features, hair, skin tone, body shape and proportions. Do not slim, reshape, beautify or change the body.
- Copy every item faithfully: colour, pattern, print, fabric, fit, length and details. Style them naturally (e.g. a bag on the shoulder, jewellery worn).
- ${hasShoes ? "Use the shoes provided." : "No shoes were provided: use simple neutral flats."} Anything not provided stays plain and neutral.
- PG-13 and modest: the person must be fully clothed. No nudity, no see-through fabric, no lingerie, no suggestive pose. If an item would leave the torso, midriff-to-hips or chest uncovered, add a plain neutral layer.
- Scene: standing straight, facing the camera, relaxed natural pose; on a round matte white podium; plain soft light-grey studio background; soft even studio light; the whole figure visible head to toe with space around it; portrait orientation.`;
}

async function imagePart(url: string) {
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  // Cutouts are transparent PNGs: put them on white so the model sees the garment clearly.
  const jpeg = await sharp(buf).flatten({ background: "#ffffff" }).resize(640, 640, { fit: "inside" }).jpeg({ quality: 86 }).toBuffer();
  return { inlineData: { mimeType: "image/jpeg", data: jpeg.toString("base64") } };
}

export function tryOnKey(bodyUrl: string, itemIds: string[]) {
  return createHash("sha256").update(`${bodyUrl}|${[...itemIds].sort().join(",")}`).digest("hex").slice(0, 32);
}

export async function tryOn(itemIds: string[], opts: { force?: boolean } = {}) {
  const profile = await getProfile();
  if (!profile.body_photo_url) throw new TryOnError("Add your full-length photo first.");
  const ids = Array.from(new Set(itemIds)).slice(0, 6);
  if (!ids.length) throw new TryOnError("Pick at least one piece to try on.");

  const key = tryOnKey(profile.body_photo_url, ids);
  const cached = await sql`select image_url from try_ons where key = ${key}`;
  if (cached.length && !opts.force) return { image_url: cached[0].image_url as string, cached: true };

  const items = (await getItemsByIds(ids)).sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category));
  if (!items.length) throw new TryOnError("Those items no longer exist.");

  const parts = await Promise.all([imagePart(profile.body_photo_url), ...items.map((i) => imagePart(i.cutout_url ?? i.crop_url))]);
  const res = await gemini().models.generateContent({
    model: GEMINI_IMAGE_MODEL,
    contents: [...parts, promptFor(items)],
    config: { responseModalities: ["IMAGE"], abortSignal: AbortSignal.timeout(90_000) },
  });
  const data = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data;
  if (!data) throw new TryOnError("The try-on couldn't be generated for this combination. Try different pieces.");
  // JPEG is ~8x smaller than the PNG the model returns, so it loads much faster on a phone.
  const jpg = await sharp(Buffer.from(data, "base64")).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
  const small = await sharp(jpg).resize(640, 640, { fit: "inside" }).jpeg({ quality: 80 }).toBuffer();

  // Second PG-13 gate on the result itself, run alongside the upload; a failing image is deleted, never returned.
  const [check, url] = await Promise.all([
    checkPhoto(small, "result"),
    putBlob(`tryons/${key}-${randomUUID().slice(0, 8)}.jpg`, jpg, "image/jpeg"),
  ]);
  if (check.clothing !== "regular_clothes" || check.explicit_or_suggestive) {
    console.warn("[try-on] result rejected by safety check:", check.reason);
    await deleteBlobs([url]);
    throw new TryOnError("That combination couldn't be shown modestly. Try adding a top or a layer.");
  }
  const old = cached[0]?.image_url as string | undefined;
  await sql`insert into try_ons (key, image_url, item_ids) values (${key}, ${url}, ${ids}::uuid[]) on conflict (key) do update set image_url = excluded.image_url, created_at = now()`;
  if (old && old !== url) await deleteBlobs([old]);
  return { image_url: url, cached: false };
}

export class TryOnError extends Error {}
