import { Type, type Schema } from "@google/genai";
import { z } from "zod";
import { generateJson } from "./gemini";
import { OUTFIT_SYSTEM_PROMPT, profileBlock } from "./prompts";
import { getProfile, incrementTimesSuggested, listItems } from "./queries";
import {
  CATEGORIES,
  COLORS,
  FABRICS,
  FITS,
  LENGTHS,
  METAL_TONES,
  NECKLINES,
  PATTERNS,
  SLEEVE_LENGTHS,
  SUBCATEGORIES,
  normaliseArray,
  normaliseValue,
} from "./taxonomy";
import type { Item } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface OutfitRequest {
  mode: "anchor" | "occasion";
  anchorItemId?: string;
  occasion?: string;
  weather?: string;
  vibe?: string;
  count?: number;
  /** Prefer rarely-suggested items (used by the daily drop). */
  preferForgotten?: boolean;
}

export interface GeneratedOutfit {
  key: string;
  name: string;
  style_tag: string;
  occasion: string | null;
  item_ids: string[];
  reasoning: string;
  missing_piece: string | null;
  color_story: string;
  items: Item[];
}

/** Something the wardrobe is missing; turned into a "To buy" card by the shopping engine (Phase 5). */
export interface Gap {
  title: string;
  category: string;
  attributes: Record<string, string>;
  why: string;
  pairs_with_item_ids: string[];
}

export interface OutfitResult {
  outfits: GeneratedOutfit[];
  gaps: Gap[];
  note: string | null;
}

// ---------------------------------------------------------------------------
// Compact wardrobe JSON (no images, short ids)
// ---------------------------------------------------------------------------
const na = (v: string | null) => (!v || v === "not_applicable" || v === "unknown" ? undefined : v);

export function compactWardrobe(items: Item[]) {
  const idMap = new Map<string, string>(); // short -> real
  const rows = items.map((it, i) => {
    const short = `i${i + 1}`;
    idMap.set(short, it.id);
    return {
      id: short,
      cat: it.category,
      sub: it.subcategory,
      color: it.primary_color,
      other_colors: it.secondary_colors.length ? it.secondary_colors : undefined,
      pattern: na(it.pattern),
      sleeve: na(it.sleeve_length),
      neck: na(it.neckline),
      fit: na(it.fit),
      length: na(it.length),
      rise: na(it.rise),
      fabric: na(it.fabric),
      metal: na(it.metal_tone),
      style: it.style,
      occasion: it.occasion,
      season: it.season,
      formality: it.formality,
      aesthetic: it.aesthetic.length ? it.aesthetic : undefined,
      desc: it.description,
      times_suggested: it.times_suggested,
    };
  });
  return { rows, idMap };
}

// ---------------------------------------------------------------------------
// Gemini schema + zod
// ---------------------------------------------------------------------------
const enumStr = (values: readonly string[]): Schema => ({ type: Type.STRING, enum: [...values] });

const GAP_ATTRS: Record<string, readonly string[]> = {
  subcategory: SUBCATEGORIES,
  primary_color: COLORS,
  pattern: PATTERNS,
  sleeve_length: SLEEVE_LENGTHS,
  neckline: NECKLINES,
  fit: FITS,
  length: LENGTHS,
  fabric: FABRICS,
  metal_tone: METAL_TONES,
};

export const OUTFIT_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    outfits: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          style_tag: { type: Type.STRING },
          item_ids: { type: Type.ARRAY, items: { type: Type.STRING } },
          reasoning: { type: Type.STRING },
          missing_piece: { type: Type.STRING, nullable: true },
          color_story: { type: Type.STRING },
        },
        required: ["name", "style_tag", "item_ids", "reasoning", "color_story"],
        propertyOrdering: ["name", "style_tag", "item_ids", "reasoning", "missing_piece", "color_story"],
      },
    },
    gaps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          category: enumStr(CATEGORIES),
          attributes: {
            type: Type.OBJECT,
            properties: Object.fromEntries(Object.entries(GAP_ATTRS).map(([k, v]) => [k, enumStr(v)])),
          },
          why: { type: Type.STRING },
          pairs_with_item_ids: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["title", "category", "why", "pairs_with_item_ids"],
        propertyOrdering: ["title", "category", "attributes", "why", "pairs_with_item_ids"],
      },
    },
    note: { type: Type.STRING, nullable: true },
  },
  required: ["outfits", "gaps"],
  propertyOrdering: ["outfits", "gaps", "note"],
};

const RawOutfitResult = z.object({
  outfits: z.array(
    z.object({
      name: z.string(),
      style_tag: z.string(),
      item_ids: z.array(z.string()),
      reasoning: z.string(),
      missing_piece: z.string().nullable().optional(),
      color_story: z.string(),
    })
  ),
  gaps: z.array(
    z.object({
      title: z.string(),
      category: z.string(),
      attributes: z.record(z.string(), z.unknown()).optional(),
      why: z.string(),
      pairs_with_item_ids: z.array(z.string()),
    })
  ),
  note: z.string().nullable().optional(),
});

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------
const BASE_OK = (cats: string[]) =>
  (cats.includes("topwear") && cats.includes("bottomwear")) || cats.includes("dress") || cats.includes("ethnic_set");

/** True when an outfit has a complete base garment. */
export function hasBaseGarment(items: Pick<Item, "category">[]) {
  return BASE_OK(items.map((i) => i.category));
}

function season(date = new Date()) {
  // Indian seasons, roughly.
  const m = date.getMonth() + 1;
  if (m >= 3 && m <= 5) return "summer";
  if (m >= 6 && m <= 9) return "monsoon";
  if (m >= 11 || m <= 1) return "winter";
  return "post-monsoon (October: warm, festive season)";
}

function userMessage(req: OutfitRequest, anchorShort: string | null, wardrobe: unknown, profile: string) {
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
  const lines = [
    `MODE: ${req.mode.toUpperCase()}`,
    req.mode === "anchor"
      ? `ANCHOR ITEM: "${anchorShort}". Build ${req.count} outfits that ALL include it, each with a different style_tag.`
      : `Build ${req.count} outfits from the whole wardrobe.`,
    req.occasion ? `OCCASION: ${req.occasion}` : "",
    req.weather ? `WEATHER: ${req.weather}` : "",
    req.vibe ? `VIBE: ${req.vibe}` : "",
    `TODAY: ${today}. Season in India: ${season()}.`,
    req.preferForgotten ? "Prefer items with a LOW times_suggested so forgotten clothes get worn." : "",
    "",
    profile,
    "",
    "Return item ids exactly as given (e.g. \"i3\"). Keep reasoning to 1–2 sentences and color_story to one short phrase.",
    "In \"gaps\" list 0–3 specific items that would complete looks or unlock many new outfits (use pairs_with_item_ids for the owned items they'd go with). Leave gaps empty if the wardrobe is fine.",
    "",
    "WARDROBE JSON:",
    JSON.stringify(wardrobe),
  ];
  return lines.filter((l) => l !== "").join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export async function generateOutfits(req: OutfitRequest): Promise<OutfitResult> {
  const count = Math.min(6, Math.max(1, req.count ?? (req.mode === "anchor" ? 5 : 4)));
  const [items, profile] = await Promise.all([listItems(), getProfile()]);
  if (!items.length) return { outfits: [], gaps: [], note: "Your closet is empty. Upload a few photos first." };

  const { rows, idMap } = compactWardrobe(items);
  const realToShort = new Map([...idMap].map(([s, r]) => [r, s]));
  const anchorShort = req.anchorItemId ? (realToShort.get(req.anchorItemId) ?? null) : null;
  if (req.mode === "anchor" && !anchorShort) throw new Error("Anchor item not found in your wardrobe");

  const raw = await generateJson(
    RawOutfitResult,
    {
      contents: userMessage({ ...req, count }, anchorShort, rows, profileBlock(profile)),
      responseSchema: OUTFIT_RESPONSE_SCHEMA,
      config: { systemInstruction: OUTFIT_SYSTEM_PROMPT, temperature: 0.8 },
    },
    { label: `outfits:${req.mode}`, timeoutMs: 50_000 }
  );

  const byId = new Map(items.map((i) => [i.id, i]));
  const toReal = (ids: string[]) =>
    Array.from(new Set(ids.map((s) => idMap.get(s.trim()) ?? (byId.has(s) ? s : null)).filter((x): x is string => !!x)));

  const anchorId = req.anchorItemId;
  const outfits: GeneratedOutfit[] = [];
  const seen = new Set<string>();
  for (const [i, o] of raw.outfits.entries()) {
    // Server-side guardrails: drop invented ids, require a base garment, anchor must be present, no duplicates.
    const ids = toReal(o.item_ids);
    const its = ids.map((id) => byId.get(id)!);
    if (!hasBaseGarment(its)) continue;
    if (req.mode === "anchor" && anchorId && !ids.includes(anchorId)) continue;
    const sig = [...ids].sort().join(",");
    if (seen.has(sig)) continue;
    seen.add(sig);
    outfits.push({
      key: `o${Date.now().toString(36)}${i}`,
      name: o.name.trim(),
      style_tag: o.style_tag.trim().toLowerCase(),
      occasion: req.occasion ?? null,
      item_ids: ids,
      reasoning: o.reasoning.trim(),
      missing_piece: o.missing_piece?.trim() || null,
      color_story: o.color_story.trim(),
      items: its,
    });
  }

  const gaps: Gap[] = raw.gaps.slice(0, 4).map((g) => {
    const attrs: Record<string, string> = {};
    for (const [k, allowed] of Object.entries(GAP_ATTRS)) {
      const v = g.attributes?.[k];
      if (v) {
        const n = normaliseValue(v, allowed, "__x__");
        if (n !== "__x__" && n !== "not_applicable") attrs[k] = n;
      }
    }
    return {
      title: g.title.trim(),
      category: normaliseValue(g.category, CATEGORIES, "accessory"),
      attributes: attrs,
      why: g.why.trim(),
      pairs_with_item_ids: normaliseArray(toReal(g.pairs_with_item_ids), items.map((i) => i.id)),
    };
  });

  await incrementTimesSuggested(outfits.flatMap((o) => o.item_ids));
  return { outfits, gaps, note: raw.note?.trim() || null };
}
