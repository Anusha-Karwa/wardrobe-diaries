import { generateJson } from "@/lib/gemini";
import { extractionPrompt } from "@/lib/prompts";
import { area, box2dToBBox, iou } from "./geometry";
import { EXTRACTION_RESPONSE_SCHEMA, RawExtractionSchema, normaliseAttributes, type ItemAttributes } from "./attributes";
import type { BBox } from "@/lib/types";

export interface DetectedItem {
  label: string;
  box_2d: number[];
  bbox: BBox;
  attrs: ItemAttributes;
}

export interface Detection {
  photoType: string;
  items: DetectedItem[];
}

// Drop tiny boxes (noise). The spec's 1.5% loses real items in wide, full-body mirror selfies
// (a crop top can be <1% of the frame), so: 0.4% for clothes, 0.1% for jewellery/small accessories.
const MIN_AREA = 0.004;
const MIN_AREA_SMALL = 0.001;
const SMALL_CATEGORIES = new Set(["jewellery", "accessory"]);
const DUP_IOU = 0.7;

/** Stage 2: one Gemini call → boxes + every taxonomy attribute (structured output, zod-validated, retried once). */
export async function detectItems(jpeg: Buffer, profileText: string): Promise<Detection> {
  const raw = await generateJson(
    RawExtractionSchema,
    {
      contents: [
        { inlineData: { mimeType: "image/jpeg", data: jpeg.toString("base64") } },
        `${extractionPrompt()}\n\n${profileText}`,
      ],
      responseSchema: EXTRACTION_RESPONSE_SCHEMA,
      config: { temperature: 0.2 },
    },
    { label: "extract", timeoutMs: 40_000 }
  );

  let items: DetectedItem[] = raw.items
    .map((it) => ({
      label: String(it.label ?? it.subcategory ?? it.category),
      box_2d: it.box_2d,
      bbox: box2dToBBox(it.box_2d),
      attrs: normaliseAttributes(it as Record<string, unknown>),
    }))
    .filter((it) => area(it.bbox) >= (SMALL_CATEGORIES.has(it.attrs.category) ? MIN_AREA_SMALL : MIN_AREA));

  // Merge duplicates: same subcategory + IoU > 0.7 → keep the more confident one.
  items.sort((a, b) => b.attrs.confidence - a.attrs.confidence);
  const kept: DetectedItem[] = [];
  for (const it of items) {
    const dup = kept.some((k) => k.attrs.subcategory === it.attrs.subcategory && iou(k.bbox, it.bbox) > DUP_IOU);
    if (!dup) kept.push(it);
  }
  // Reading order: top-to-bottom, then left-to-right.
  items = kept.sort((a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x);

  return { photoType: raw.photo_type ?? "mixed", items };
}
