import { Type, type Schema } from "@google/genai";
import { z } from "zod";
import {
  CATEGORIES,
  MULTI_ATTRS,
  SINGLE_ATTRS,
  SUBCATEGORIES_BY_CATEGORY,
  categoryOfSubcategory,
  normaliseArray,
  normaliseValue,
  type Category,
} from "@/lib/taxonomy";

export const PHOTO_TYPES = ["flat_lay", "hanger", "product_shot", "worn", "mixed"] as const;

// ---------------------------------------------------------------------------
// Gemini responseSchema (enums come straight from the taxonomy)
// ---------------------------------------------------------------------------
const str = (values?: readonly string[], nullable = false): Schema => ({
  type: Type.STRING,
  ...(values ? { enum: [...values] } : {}),
  ...(nullable ? { nullable: true } : {}),
});
const arr = (values: readonly string[]): Schema => ({ type: Type.ARRAY, items: str(values) });

const itemProps: Record<string, Schema> = {
  box_2d: { type: Type.ARRAY, items: { type: Type.INTEGER }, minItems: "4", maxItems: "4" },
  label: str(),
  ...Object.fromEntries(Object.entries(SINGLE_ATTRS).map(([k, v]) => [k, str(v)])),
  primary_color_hex: str(),
  ...Object.fromEntries(Object.entries(MULTI_ATTRS).map(([k, v]) => [k, arr(v)])),
  formality: { type: Type.INTEGER, minimum: 1, maximum: 5 },
  brand_visible: str(undefined, true),
  size: str(undefined, true),
  description: str(),
  confidence: { type: Type.NUMBER, minimum: 0, maximum: 1 },
};

export const EXTRACTION_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    photo_type: str(PHOTO_TYPES),
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: itemProps,
        required: Object.keys(itemProps).filter((k) => k !== "brand_visible" && k !== "size"),
        propertyOrdering: Object.keys(itemProps),
      },
    },
  },
  required: ["items"],
  propertyOrdering: ["photo_type", "items"],
};

// ---------------------------------------------------------------------------
// zod: loose on purpose (strings), then normalised to the taxonomy below
// ---------------------------------------------------------------------------
const loose = z.unknown().optional();
export const RawExtractionSchema = z.object({
  photo_type: z.string().optional(),
  items: z.array(
    z
      .object({
        box_2d: z.array(z.number()).length(4),
        label: z.string().optional(),
        category: z.string(),
        subcategory: loose,
        primary_color: loose,
        primary_color_hex: loose,
        formality: loose,
        brand_visible: loose,
        size: loose,
        description: loose,
        confidence: loose,
      })
      .passthrough()
  ),
});
export type RawExtraction = z.infer<typeof RawExtractionSchema>;
export type RawItem = RawExtraction["items"][number];

/** Every attribute an item row stores (no ids/urls). */
export interface ItemAttributes {
  category: Category;
  subcategory: string;
  primary_color: string;
  primary_color_hex: string | null;
  secondary_colors: string[];
  pattern: string;
  sleeve_length: string;
  sleeve_style: string;
  neckline: string;
  fit: string;
  length: string;
  rise: string;
  fabric: string;
  wash: string;
  embellishment: string;
  style: string;
  metal_tone: string;
  occasion: string[];
  season: string[];
  formality: number;
  aesthetic: string[];
  brand_visible: string | null;
  size: string | null;
  description: string;
  confidence: number;
}

const NA_FALLBACK = new Set(["sleeve_length", "sleeve_style", "neckline", "length", "rise", "wash", "metal_tone"]);
const SINGLE_FALLBACK: Record<string, string> = {
  pattern: "solid",
  fit: "regular",
  fabric: "unknown",
  embellishment: "none",
  style: "western",
  primary_color: "multicolor",
};

const nullableText = (v: unknown) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return !s || /^(null|none|n\/a|unknown)$/i.test(s) ? null : s.slice(0, 80);
};

/** Map any (model or user) attribute object onto valid taxonomy values. */
export function normaliseAttributes(raw: Record<string, unknown>): ItemAttributes {
  // Subcategory decides the category when they disagree (it's more specific).
  let category = normaliseValue(raw.category, CATEGORIES, "accessory") as Category;
  const allSubs = Object.values(SUBCATEGORIES_BY_CATEGORY).flat() as string[];
  const sub = normaliseValue(raw.subcategory, [...allSubs, "other"], "other");
  const subCat = categoryOfSubcategory(sub);
  if (subCat && subCat !== category) category = subCat;

  const out: Record<string, unknown> = { category, subcategory: sub };
  for (const [k, allowed] of Object.entries(SINGLE_ATTRS)) {
    if (k === "category" || k === "subcategory") continue;
    const fallback = NA_FALLBACK.has(k) ? "not_applicable" : (SINGLE_FALLBACK[k] ?? "other");
    out[k] = normaliseValue(raw[k], allowed, fallback);
  }
  for (const [k, allowed] of Object.entries(MULTI_ATTRS)) out[k] = normaliseArray(raw[k], allowed);
  if (!(out.season as string[]).length) out.season = ["all_season"];

  const hex = String(raw.primary_color_hex ?? "").trim();
  const f = Math.round(Number(raw.formality));
  const c = Number(raw.confidence);
  return {
    ...(out as Omit<ItemAttributes, "primary_color_hex" | "formality" | "brand_visible" | "size" | "description" | "confidence">),
    primary_color_hex: /^#[0-9a-f]{6}$/i.test(hex) ? hex.toLowerCase() : null,
    formality: Number.isFinite(f) ? Math.min(5, Math.max(1, f)) : 2,
    brand_visible: nullableText(raw.brand_visible),
    size: nullableText(raw.size),
    description: String(raw.description ?? raw.label ?? sub).trim().slice(0, 300),
    confidence: Number.isFinite(c) ? Math.min(1, Math.max(0, c)) : 0.5,
  };
}
