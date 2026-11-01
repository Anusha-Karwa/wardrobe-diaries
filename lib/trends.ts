import { randomUUID } from "node:crypto";
import { Type, type Schema } from "@google/genai";
import { z } from "zod";
import { generate, generateJson } from "./gemini";
import { TREND_RESEARCH_PROMPT, fill, profileBlock } from "./prompts";
import { getProfile, listItems } from "./queries";
import { sql } from "./db";
import { compactWardrobe } from "./outfits";
import { buildSearchQuery } from "./shopping";
import {
  AESTHETICS,
  CATEGORIES,
  COLORS,
  EMBELLISHMENTS,
  FABRICS,
  FITS,
  LENGTHS,
  METAL_TONES,
  NECKLINES,
  PATTERNS,
  SLEEVE_LENGTHS,
  SLEEVE_STYLES,
  SUBCATEGORIES,
  normaliseArray,
  normaliseValue,
  COLOR_NEIGHBOURS,
} from "./taxonomy";
import type { Item, Trend } from "./types";

/**
 * Trend engine (spec 6i):
 *  1. grounded research (Google Search tool, plain text) per category group
 *  2. structure the text into taxonomy-vocabulary JSON (no tools)
 *  3. match against the wardrobe: code for "owned", one batched Gemini call for "pairs with" + notes
 *  4. save under one batch_id, deduping near-identical titles
 * Search grounding and structured output are NEVER combined in one request.
 */

import { CATEGORY_GROUPS, type GroupKey } from "./trend-groups";
export { CATEGORY_GROUPS, type GroupKey };

export interface Source {
  title: string;
  url: string;
}

const todayIST = () =>
  new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

// ---------------------------------------------------------------------------
// Step 1: grounded research
// ---------------------------------------------------------------------------
/** Grounding links are temporary redirects; resolve them to the real article URL. */
async function resolveSource(uri: string, title: string): Promise<Source> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(uri, { redirect: "manual", signal: ctrl.signal });
    clearTimeout(t);
    const loc = res.headers.get("location");
    if (loc && /^https?:\/\//.test(loc)) return { title, url: loc };
  } catch {
    /* keep the redirect link */
  }
  return { title, url: uri };
}

export async function researchGroup(groupKey: GroupKey, genderPref: string) {
  const group = CATEGORY_GROUPS.find((g) => g.key === groupKey)!;
  const prompt = fill(TREND_RESEARCH_PROMPT, { gender_pref: genderPref || "women", date: todayIST(), category_group: group.research });

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await generate(
      {
        contents: attempt === 0 ? prompt : `${prompt}\n\nIMPORTANT: search Google first and base every trend on what you find.`,
        config: { tools: [{ googleSearch: {} }], temperature: 0.4 },
      },
      { label: `trends:research:${groupKey}`, timeoutMs: 90_000, thinkingLevel: "LOW" }
    );
    const gm = res.candidates?.[0]?.groundingMetadata;
    const chunks = gm?.groundingChunks ?? [];
    if (chunks.some((c) => c.web?.uri) || attempt === 1) {
      // Keep chunk indexes so each trend can cite the sources that support ITS sentences.
      const sources = await Promise.all(
        chunks.map((c) => (c.web?.uri ? resolveSource(c.web.uri, c.web.title ?? new URL(c.web.uri).hostname) : Promise.resolve(null)))
      );
      const supports = (gm?.groundingSupports ?? [])
        .map((s) => ({ text: s.segment?.text ?? "", chunks: s.groundingChunkIndices ?? [] }))
        .filter((s) => s.text && s.chunks.length);
      return { text: res.text ?? "", sources, supports };
    }
    console.warn(`[trends] ${groupKey}: no search results on attempt 1, retrying with a stronger instruction`);
  }
  return { text: "", sources: [] as (Source | null)[], supports: [] as Support[] };
}

interface Support {
  text: string;
  chunks: number[];
}

/** Sources for one trend: the chunks whose supported sentences mention the trend; fall back to the group's top sources. */
export function sourcesForTrend(title: string, sources: (Source | null)[], supports: Support[], max = 3): Source[] {
  const tw = [...words(title)];
  const score = new Map<number, number>();
  for (const s of supports) {
    const sw = words(s.text);
    const hits = tw.filter((w) => sw.has(w)).length;
    if (!hits) continue;
    for (const c of s.chunks) score.set(c, (score.get(c) ?? 0) + hits);
  }
  const ranked = [...score.entries()].sort((a, b) => b[1] - a[1]).map(([i]) => sources[i]).filter((x): x is Source => !!x);
  const fallback = sources.filter((x): x is Source => !!x);
  const out: Source[] = [];
  for (const s of [...ranked, ...fallback]) {
    if (out.length >= max) break;
    if (!out.some((o) => o.url === s.url)) out.push(s);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Step 2: structure (taxonomy vocabulary, no tools)
// ---------------------------------------------------------------------------
const MATCH_ATTRS: Record<string, readonly string[]> = {
  subcategory: SUBCATEGORIES,
  primary_color: COLORS,
  pattern: PATTERNS,
  sleeve_length: SLEEVE_LENGTHS,
  sleeve_style: SLEEVE_STYLES,
  neckline: NECKLINES,
  fit: FITS,
  length: LENGTHS,
  fabric: FABRICS,
  embellishment: EMBELLISHMENTS,
  metal_tone: METAL_TONES,
  aesthetic: AESTHETICS,
};
const arrEnum = (v: readonly string[]): Schema => ({ type: Type.ARRAY, items: { type: Type.STRING, enum: [...v] } });

const TREND_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    trends: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          category: { type: Type.STRING, enum: [...CATEGORIES] },
          match_attributes: {
            type: Type.OBJECT,
            properties: Object.fromEntries(Object.entries(MATCH_ATTRS).map(([k, v]) => [k, arrEnum(v)])),
          },
          summary: { type: Type.STRING },
          why_now: { type: Type.STRING },
          how_to_style: { type: Type.STRING },
          heat: { type: Type.INTEGER, minimum: 1, maximum: 5 },
          price_band: { type: Type.STRING },
          search_query: { type: Type.STRING },
        },
        required: ["title", "category", "match_attributes", "summary", "why_now", "how_to_style", "heat", "price_band", "search_query"],
        propertyOrdering: ["title", "category", "match_attributes", "summary", "why_now", "how_to_style", "heat", "price_band", "search_query"],
      },
    },
  },
  required: ["trends"],
};

const RawTrends = z.object({
  trends: z.array(
    z.object({
      title: z.string(),
      category: z.string(),
      match_attributes: z.record(z.string(), z.array(z.string())).default({}),
      summary: z.string(),
      why_now: z.string(),
      how_to_style: z.string(),
      heat: z.number(),
      price_band: z.string(),
      search_query: z.string(),
    })
  ),
});

/** Attributes that can prove you own a trend (type, length and mood alone can't). */
const DISTINCTIVE = new Set(["neckline", "fit", "fabric", "pattern", "sleeve_style", "embellishment", "metal_tone", "primary_color"]);
/** Never used for matching: a mood isn't a physical feature. */
const IGNORED_FOR_MATCH = new Set(["aesthetic"]);
/** Values that are too generic to infer from a title word. */
const TITLE_SKIP = new Set(["regular", "round", "solid", "none", "short", "long", "full", "mini", "midi", "maxi", "knee", "other", "unknown", "not_applicable", "collar", "mesh", "net", "lace_trim", "studs", "slim"]);
const TITLE_ALIASES: Record<string, [string, string]> = {
  studded: ["embellishment", "studs"],
  sequin: ["embellishment", "sequins"],
  sequinned: ["embellishment", "sequins"],
  beaded: ["embellishment", "beads"],
  pearl: ["metal_tone", "pearl"],
  polki: ["metal_tone", "kundan"],
  kundan: ["metal_tone", "kundan"],
  oxidised: ["metal_tone", "oxidised"],
  "off-shoulder": ["neckline", "off_shoulder"],
  "one-shoulder": ["neckline", "one_shoulder"],
  "wide-leg": ["fit", "wide_leg"],
  "barrel-leg": ["fit", "barrel"],
  embroidered: ["embellishment", "embroidery"],
  "mirror-work": ["embellishment", "mirror_work"],
  crochet: ["fabric", "crochet"],
  sheer: ["fabric", "net"],
  ikat: ["pattern", "ikat"],
  bandhani: ["pattern", "bandhani"],
  "polka-dot": ["pattern", "polka_dot"],
};

/**
 * The structuring model sometimes drops the attribute that defines a trend ("barrel-leg jeans" → just jeans).
 * Read it back from the title: any taxonomy value named in the title is added to match_attributes.
 */
export function augmentFromTitle(title: string, category: string | null, match: Record<string, string[]>) {
  const t = ` ${title.toLowerCase().replace(/[^a-z0-9-]+/g, " ")} `;
  const out: Record<string, string[]> = Object.fromEntries(Object.entries(match).map(([k, v]) => [k, [...v]]));
  // Values the model already gave count as "used", so the title doesn't add an equivalent twice.
  const used = new Set(Object.values(match).flat().map((v) => canon(v)));
  const add = (k: string, v: string) => {
    if (k === "metal_tone" && category !== "jewellery" && category !== "accessory" && category !== "bag") return;
    if (used.has(canon(v))) return; // one word → one attribute ("embroidered" isn't both a pattern and an embellishment)
    used.add(canon(v));
    out[k] = Array.from(new Set([...(out[k] ?? []), v]));
  };
  for (const [word, [k, v]] of Object.entries(TITLE_ALIASES)) if (t.includes(` ${word}`)) add(k, v);
  for (const k of ["neckline", "fit", "fabric", "embellishment", "pattern", "sleeve_style", "metal_tone"]) {
    for (const v of MATCH_ATTRS[k]) {
      if (TITLE_SKIP.has(v)) continue;
      const forms = [v.replace(/_/g, " "), v.replace(/_/g, "-")];
      if (forms.some((f) => t.includes(` ${f} `) || t.includes(` ${f}s `) || t.includes(` ${f}-`))) add(k, v);
    }
  }
  return out;
}

/** Tags that mean the same thing across attributes (lace fabric ≈ lace pattern, embroidered ≈ embroidery…). */
const EQUIV: Record<string, string> = { embroidered: "embroidery", sequinned: "sequins", mesh_net: "net", mesh: "net", lace_trim: "lace", beads: "beads" };
const canon = (v: string) => EQUIV[v] ?? v;

export type StructuredTrend = Omit<Trend, "id" | "batch_id" | "period" | "created_at" | "sources"> & { sources: Source[] };

export async function structureTrends(
  text: string,
  sources: (Source | null)[],
  genderPref: string,
  supports: Support[] = []
): Promise<StructuredTrend[]> {
  if (!text.trim()) return [];
  const raw = await generateJson(
    RawTrends,
    {
      contents: `Convert this trend research into JSON. Keep every specific, shoppable trend (usually 4–6).
- "category": the closest taxonomy category.
- "match_attributes": the 1–3 attributes that DEFINE the trend, using the allowed values. Use at most 2 subcategories, and ALWAYS include at least one distinctive attribute besides subcategory when the vocabulary can express it (e.g. halter-neck tops → {"subcategory":["crop_top","blouse"],"neckline":["halter"]}; barrel-leg jeans → {"subcategory":["jeans"],"fit":["barrel"]}; chunky gold hoops → {"subcategory":["earrings"],"metal_tone":["gold"]}; polki/kundan chokers → {"subcategory":["necklace"],"metal_tone":["kundan"]}; sheer lace tops → {"fabric":["lace"]}). If the trend can't be expressed beyond its type, give only the subcategory. Don't add colours unless the colour IS the trend.
- "heat": 1–5, how strong the trend is right now.
- "price_band": a short Indian price range like "₹800–2,500".
- "search_query": what a shopper would type on Myntra, lowercase, e.g. "white halter neck lace top".
- Keep summary, why_now and how_to_style to 1–2 sentences each.

RESEARCH:
${text}`,
      responseSchema: TREND_SCHEMA,
      config: { temperature: 0.2 },
    },
    { label: "trends:structure", timeoutMs: 60_000, thinkingLevel: "LOW" }
  );

  return raw.trends.map((t) => {
    const match: Record<string, string[]> = {};
    for (const [k, allowed] of Object.entries(MATCH_ATTRS)) {
      const vals = normaliseArray(t.match_attributes[k] ?? [], allowed).filter((v) => v !== "not_applicable" && v !== "other");
      if (vals.length) match[k] = vals;
    }
    const category = normaliseValue(t.category, CATEGORIES, "accessory");
    return {
      group_key: null,
      title: t.title.trim(),
      category,
      match_attributes: augmentFromTitle(t.title, category, match),
      summary: t.summary.trim(),
      why_now: t.why_now.trim(),
      how_to_style: t.how_to_style.trim(),
      heat: Math.min(5, Math.max(1, Math.round(t.heat))),
      price_band: t.price_band.trim(),
      search_query: buildSearchQuery(t.search_query || t.title, genderPref),
      // Top 3 sources per trend: those supporting sentences about this trend, else the group's.
      sources: sourcesForTrend(t.title, sources, supports),
    } as StructuredTrend;
  });
}

// ---------------------------------------------------------------------------
// Step 4 helpers: dedupe + save
// ---------------------------------------------------------------------------
const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 2 && !["the", "and", "with"].includes(w)));
function similar(a: string, b: string) {
  const A = words(a), B = words(b);
  const inter = [...A].filter((w) => B.has(w)).length;
  return inter / Math.max(1, Math.min(A.size, B.size)) >= 0.75;
}

export async function saveTrends(batchId: string, period: string, groupKey: string, trends: StructuredTrend[]) {
  const kept: StructuredTrend[] = [];
  for (const t of trends) if (!kept.some((k) => similar(k.title, t.title))) kept.push(t);
  const ids: string[] = [];
  for (const t of kept) {
    const rows = await sql`
      insert into trends (batch_id, period, group_key, title, category, match_attributes, summary, why_now, how_to_style, heat, price_band, search_query, sources)
      values (${batchId}, ${period}, ${groupKey}, ${t.title}, ${t.category}, ${JSON.stringify(t.match_attributes)}::jsonb, ${t.summary},
              ${t.why_now}, ${t.how_to_style}, ${t.heat}, ${t.price_band}, ${t.search_query}, ${JSON.stringify(t.sources)}::jsonb)
      returning id`;
    ids.push(rows[0].id as string);
  }
  return ids;
}

/** Research + structure + save ONE group (fits comfortably in a 60s request). */
export async function refreshGroup(groupKey: GroupKey, opts: { batchId?: string; period?: "daily" | "weekly" } = {}) {
  const started = Date.now();
  const profile = await getProfile();
  const { text, sources, supports } = await researchGroup(groupKey, profile.gender_pref);
  const structured = await structureTrends(text, sources, profile.gender_pref, supports);
  const batchId = opts.batchId ?? randomUUID();
  const ids = await saveTrends(batchId, opts.period ?? "daily", groupKey, structured);
  const nSources = sources.filter(Boolean).length;
  console.log(`[trends] ${groupKey}: ${ids.length} trends, ${nSources} sources, ${Date.now() - started}ms`);
  return { groupKey, batchId, count: ids.length, sources: nSources };
}

// ---------------------------------------------------------------------------
// Reading current trends
// ---------------------------------------------------------------------------
export interface TrendWithMatch extends Trend {
  group_key: string | null;
  status: "owned" | "missing" | null;
  owned_item_ids: string[];
  pairs_with_item_ids: string[];
  note: string | null;
}

/** The newest batch for EACH group (daily runs refresh only some groups). */
export async function getCurrentTrends(): Promise<TrendWithMatch[]> {
  return (await sql`
    with latest as (
      select distinct on (group_key) group_key, batch_id from trends where group_key is not null order by group_key, created_at desc
    )
    select t.*, m.status, coalesce(m.owned_item_ids, '{}') as owned_item_ids, coalesce(m.pairs_with_item_ids, '{}') as pairs_with_item_ids, m.note
    from trends t
    join latest l on l.group_key = t.group_key and l.batch_id = t.batch_id
    left join trend_matches m on m.trend_id = t.id
    order by t.heat desc nulls last, t.created_at desc`) as TrendWithMatch[];
}

/** Older trends (not in the current set), newest first, for the "past weeks" view. */
export async function getPastTrends(limit = 80): Promise<TrendWithMatch[]> {
  return (await sql`
    with latest as (
      select distinct on (group_key) group_key, batch_id from trends where group_key is not null order by group_key, created_at desc
    )
    select t.*, m.status, coalesce(m.owned_item_ids, '{}') as owned_item_ids, coalesce(m.pairs_with_item_ids, '{}') as pairs_with_item_ids, m.note
    from trends t
    left join trend_matches m on m.trend_id = t.id
    where not exists (select 1 from latest l where l.group_key = t.group_key and l.batch_id = t.batch_id)
    order by t.created_at desc
    limit ${limit}`) as TrendWithMatch[];
}

export async function newestTrendAgeHours() {
  const r = await sql`select extract(epoch from now() - max(created_at)) / 3600 as h from trends`;
  return r[0]?.h === null || r[0]?.h === undefined ? Infinity : Number(r[0].h);
}

// ---------------------------------------------------------------------------
// Step 3: match against the wardrobe
// ---------------------------------------------------------------------------
const valuesOf = (it: Item, k: string): string[] => {
  const v = it[k as keyof Item];
  return Array.isArray(v) ? (v as string[]) : v ? [String(v)] : [];
};

/**
 * An item is "in" a trend if it matches the category and EVERY defining attribute (colour with neighbour fuzziness).
 * At least one DISTINCTIVE attribute (neckline, fit, fabric, pattern…) must define the trend: a trend described only by
 * its type, length or mood ("any necklace", "midi") can't prove ownership, so it never counts as owned.
 */
export function ownsTrend(item: Item, t: Pick<Trend, "category" | "match_attributes">) {
  if (t.category && item.category !== t.category) return false;
  const m = t.match_attributes ?? {};
  const keys = Object.keys(m).filter((k) => m[k]?.length && !IGNORED_FOR_MATCH.has(k));
  if (!keys.some((k) => DISTINCTIVE.has(k))) return false;
  // Physical "texture" tags can live in fabric, pattern or embellishment depending on how the item was tagged.
  const texture = new Set([...valuesOf(item, "fabric"), ...valuesOf(item, "pattern"), ...valuesOf(item, "embellishment")].map(canon));
  return keys.every((k) => {
    let want = m[k];
    if (k === "primary_color") want = [...want, ...want.flatMap((c) => COLOR_NEIGHBOURS[c] ?? [])];
    if (k === "fabric" || k === "pattern" || k === "embellishment") return want.some((w) => texture.has(canon(w)));
    const have = k === "primary_color" ? [...valuesOf(item, "primary_color"), ...item.secondary_colors] : valuesOf(item, k);
    return have.some((h) => want.includes(h));
  });
}

const PairsSchema = z.object({
  matches: z.array(z.object({ trend: z.string(), pairs_with: z.array(z.string()), note: z.string() })),
});
const PAIRS_RESPONSE: Schema = {
  type: Type.OBJECT,
  properties: {
    matches: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { trend: { type: Type.STRING }, pairs_with: { type: Type.ARRAY, items: { type: Type.STRING } }, note: { type: Type.STRING } },
        required: ["trend", "pairs_with", "note"],
      },
    },
  },
  required: ["matches"],
};

/** Match every current trend against the wardrobe and store trend_matches. */
export async function matchCurrentTrends() {
  const started = Date.now();
  const [trends, items, profile] = await Promise.all([getCurrentTrends(), listItems(), getProfile()]);
  if (!trends.length) return { matched: 0, owned: 0 };

  // Code first: owned / missing.
  const owned = new Map(trends.map((t) => [t.id, items.filter((i) => ownsTrend(i, t)).map((i) => i.id)]));

  // AI second: one batched call for pairs + a one-line note per trend.
  const pairs = new Map<string, { ids: string[]; note: string }>();
  if (items.length) {
    const { rows, idMap } = compactWardrobe(items);
    const realToShort = new Map([...idMap].map(([s, r]) => [r, s]));
    const tShort = trends.map((t, i) => ({
      id: `t${i + 1}`,
      title: t.title,
      category: t.category,
      how_to_style: t.how_to_style,
      already_owned: (owned.get(t.id) ?? []).map((id) => realToShort.get(id)),
    }));
    try {
      const res = await generateJson(
        PairsSchema,
        {
          contents: `Return exactly ONE entry for EVERY trend below (same ids, same order). For each trend, pick up to 4 items from the user's wardrobe that would pair well with it (by exact "id"), and write ONE friendly sentence ("note").
- If "already_owned" is non-empty, the user owns a piece in this trend: the note says how to style what they own (e.g. "You already own a white lace top — wear it with your wide-leg jeans and gold hoops").
- Otherwise the note says the user doesn't own one yet and how it would work with what they own (e.g. "You don't own one yet; it would go with 4 of your bottoms, like your black skinny jeans").
- Name the trend piece, not other jewellery or clothes, as the thing to buy.
Never invent ids.

${profileBlock(profile)}

TRENDS: ${JSON.stringify(tShort)}

WARDROBE JSON: ${JSON.stringify(rows)}`,
          responseSchema: PAIRS_RESPONSE,
          config: { temperature: 0.4 },
        },
        { label: "trends:pairs", timeoutMs: 50_000 }
      );
      for (const m of res.matches) {
        const idx = Number(m.trend.replace(/\D/g, "")) - 1;
        const t = trends[idx];
        if (!t) continue;
        const ids = m.pairs_with.map((s) => idMap.get(s.trim())).filter((x): x is string => !!x);
        pairs.set(t.id, { ids: Array.from(new Set(ids)).slice(0, 4), note: m.note.trim() });
      }
    } catch (err) {
      console.warn("[trends] pairs call failed; saving owned/missing only:", (err as Error).message);
    }
  }

  let ownedCount = 0;
  for (const t of trends) {
    const o = owned.get(t.id) ?? [];
    if (o.length) ownedCount++;
    const p = pairs.get(t.id);
    const pairIds = (p?.ids ?? []).filter((id) => !o.includes(id));
    await sql`
      insert into trend_matches (trend_id, status, owned_item_ids, pairs_with_item_ids, note)
      values (${t.id}, ${o.length ? "owned" : "missing"}, ${o}::uuid[], ${pairIds}::uuid[], ${p?.note ?? null})
      on conflict (trend_id) do update set status = excluded.status, owned_item_ids = excluded.owned_item_ids,
        pairs_with_item_ids = excluded.pairs_with_item_ids, note = excluded.note`;
  }
  console.log(`[trends] matched ${trends.length} trends (${ownedCount} owned) in ${Date.now() - started}ms`);
  return { matched: trends.length, owned: ownedCount };
}

/** Whole refresh in one go (used by cron/seed, where there is no 60s browser request to worry about per step). */
export async function refreshAll(groups: readonly GroupKey[] = CATEGORY_GROUPS.map((g) => g.key), period: "daily" | "weekly" = "daily", concurrency = 3) {
  const batchId = randomUUID();
  const queue = [...groups];
  const results: Awaited<ReturnType<typeof refreshGroup>>[] = [];
  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (queue.length) {
        const g = queue.shift()!;
        try {
          results.push(await refreshGroup(g, { batchId, period }));
        } catch (err) {
          console.error(`[trends] ${g} failed:`, (err as Error).message);
        }
      }
    })
  );
  const match = await matchCurrentTrends();
  return { batchId, results, ...match };
}
