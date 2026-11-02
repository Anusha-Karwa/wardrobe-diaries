import sharp from "sharp";
import { gemini } from "@/lib/gemini";
import { labelize } from "@/lib/utils";
import { chromaKey, finishCutout, type KeyColour } from "./cutout";
import type { DetectedItem } from "./detect";

/**
 * Worn items (mirror selfies): Gemini's image model re-draws the item alone as an
 * e-commerce product shot on a flat key colour, which we then remove with sharp.
 * Gemini segmentation masks don't work on current Gemini 3 Flash models, and browser
 * background removal keeps the person's body, so this is the clean option for worn items.
 * It is an AI re-render (badged "AI product shot" in the UI); the real crop is always kept.
 */
export const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";

const GREENISH = new Set(["green", "olive", "mint", "teal", "multicolor"]);

function keyFor(item: DetectedItem): KeyColour {
  const colours = [item.attrs.primary_color, ...item.attrs.secondary_colors];
  return colours.some((c) => GREENISH.has(c)) ? "magenta" : "green";
}

function promptFor(item: DetectedItem, key: KeyColour) {
  const a = item.attrs;
  const what = a.description || `${labelize(a.primary_color)} ${labelize(a.subcategory)}`;
  const bg = key === "green" ? "pure green #00FF00" : "pure magenta #FF00FF";
  return `Product photo extraction. This is a photo (a close crop, or a store photo that may show a model). Isolate ONLY this item: ${what} (${labelize(a.category)} / ${labelize(a.subcategory)}).
Output one image: the exact same item, keeping its colour, wash, print, texture, neckline, straps, hardware, details, damage and proportions exactly as in the photo, shown alone as a front-facing e-commerce product shot (ghost-mannequin or flat-lay style), centred, filling about 80% of the frame.
Background: perfectly flat, uniform ${bg}. No shadows, no gradient, no floor, no text.
Remove the person entirely: no skin, hair, face, hands or body, and no other clothing or accessories (straps of a bag crossing the item must be removed). Do not add anything that isn't in the original.`;
}

export async function aiProductShot(cropJpeg: Buffer, item: DetectedItem, timeoutMs = 30_000): Promise<Buffer | null> {
  const key = keyFor(item);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    // Give the model a decent-resolution crop to copy details from.
    const input = await sharp(cropJpeg).resize(1024, 1024, { fit: "inside", withoutEnlargement: false }).jpeg({ quality: 90 }).toBuffer();
    const res = await gemini().models.generateContent({
      model: GEMINI_IMAGE_MODEL,
      contents: [{ inlineData: { mimeType: "image/jpeg", data: input.toString("base64") } }, promptFor(item, key)],
      config: { abortSignal: controller.signal, responseModalities: ["IMAGE"] },
    });
    const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part?.inlineData?.data) return null;
    const { png, transparentFraction } = await chromaKey(Buffer.from(part.inlineData.data, "base64"), key);
    // Quality check: the key colour should be a good share of the frame, but not all of it.
    if (transparentFraction < 0.2 || transparentFraction > 0.97) {
      console.warn(`[product-shot] rejected (${Math.round(transparentFraction * 100)}% keyed) for ${item.label}`);
      return null;
    }
    return await finishCutout(png);
  } catch (err) {
    console.warn(`[product-shot] failed for ${item.label}:`, (err as Error).message);
    return null;
  } finally {
    clearTimeout(timer);
    if (process.env.NODE_ENV !== "production") console.log(`[product-shot] ${item.label} ${Date.now() - started}ms`);
  }
}
