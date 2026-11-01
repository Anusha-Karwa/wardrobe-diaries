import { Type, type FunctionDeclaration, type Schema } from "@google/genai";
import { generate } from "../gemini";
import { putBlob } from "../blob";
import { renderBoard } from "../board";
import { generateOutfits, hasBaseGarment, type GeneratedOutfit } from "../outfits";
import { addToWishlist, getLatestTrends, insertOutfit, setOutfitBoard, type Profile } from "../queries";
import { toBuyCard } from "../shopping";
import { getCurrentTrends, matchCurrentTrends, newestTrendAgeHours, refreshGroup, type GroupKey } from "../trends";
import {
  AESTHETICS,
  CATEGORIES,
  COLORS,
  FABRICS,
  FITS,
  LENGTHS,
  METAL_TONES,
  NECKLINES,
  OCCASIONS,
  PATTERNS,
  SEASONS,
  SLEEVE_LENGTHS,
  STYLES,
  SUBCATEGORIES,
  neighboursOf,
  normaliseValue,
} from "../taxonomy";
import type { BuyCard, Item } from "../types";
import { labelize } from "../utils";

// ---------------------------------------------------------------------------
// Per-request context: everything the tools produce is cached here by key,
// so respond_to_user can only reference real outfits/buy cards.
// ---------------------------------------------------------------------------
export interface AgentContext {
  wardrobe: Item[];
  profile: Profile;
  outfits: Map<string, GeneratedOutfit>;
  buys: Map<string, BuyCard>;
  sources: Map<string, { title: string; url: string }>;
  progress: (label: string) => void;
}

const compact = (i: Item) => ({
  id: i.id,
  description: i.description,
  category: i.category,
  subcategory: i.subcategory,
  color: i.primary_color,
  pattern: i.pattern,
  sleeve: i.sleeve_length === "not_applicable" ? undefined : i.sleeve_length,
  neckline: i.neckline === "not_applicable" ? undefined : i.neckline,
  fit: i.fit,
  occasion: i.occasion,
  formality: i.formality,
});

// ---------------------------------------------------------------------------
// Function declarations
// ---------------------------------------------------------------------------
const arr = (values: readonly string[], description?: string): Schema => ({
  type: Type.ARRAY,
  items: { type: Type.STRING, enum: [...values] },
  ...(description ? { description } : {}),
});

const FILTER_PROPS: Record<string, Schema> = {
  category: arr(CATEGORIES),
  subcategory: arr(SUBCATEGORIES),
  primary_color: arr(COLORS),
  pattern: arr(PATTERNS),
  sleeve_length: arr(SLEEVE_LENGTHS),
  neckline: arr(NECKLINES),
  fit: arr(FITS),
  length: arr(LENGTHS),
  fabric: arr(FABRICS),
  occasion: arr(OCCASIONS),
  season: arr(SEASONS),
  style: arr(STYLES),
  aesthetic: arr(AESTHETICS),
  metal_tone: arr(METAL_TONES),
};

const GAP_ITEM: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'Specific item, e.g. "white halter-neck lace top, cropped, fitted"' },
    category: { type: Type.STRING, enum: [...CATEGORIES] },
    primary_color: { type: Type.STRING, enum: [...COLORS] },
    why: { type: Type.STRING, description: "Why it works with what they own (1 sentence)" },
    pairs_with_item_ids: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Owned item ids it pairs with" },
  },
  required: ["title", "category", "why"],
};

export const DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "search_wardrobe",
    description:
      "Search the user's wardrobe with taxonomy filters (values within a filter are OR, across filters AND). Returns exact matches and close matches (neighbour colours/sleeves/fits, or all-but-one filter). Use for any 'do I have…' or 'what goes with my…' question.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        filters: { type: Type.OBJECT, properties: FILTER_PROPS, description: "Taxonomy filters" },
        text: { type: Type.STRING, description: "Optional free-text words to match in descriptions (only if filters can't express it)" },
      },
    },
  },
  {
    name: "get_items",
    description: "Full details for specific wardrobe items by id.",
    parameters: { type: Type.OBJECT, properties: { ids: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["ids"] },
  },
  {
    name: "build_outfits",
    description:
      "Build complete outfits ONLY from the user's wardrobe. mode 'anchor' = every outfit includes anchor_item_id; 'occasion' = from the whole wardrobe. Returns outfit keys (o1, o2…) to show via respond_to_user, plus gaps (what's missing).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        mode: { type: Type.STRING, enum: ["anchor", "occasion"] },
        anchor_item_id: { type: Type.STRING },
        occasion: { type: Type.STRING, description: "e.g. office, date night, wedding guest" },
        weather: { type: Type.STRING },
        vibe: { type: Type.STRING },
        count: { type: Type.INTEGER, minimum: 1, maximum: 5 },
      },
      required: ["mode"],
    },
  },
  {
    name: "find_gaps",
    description: "Ask the stylist engine specifically what's MISSING to complete good looks (around an item, or for an occasion). Returns gaps to pass to shop_suggestions.",
    parameters: {
      type: Type.OBJECT,
      properties: { anchor_item_id: { type: Type.STRING }, occasion: { type: Type.STRING } },
    },
  },
  {
    name: "get_trends",
    description:
      "Current fashion trends (researched daily with Google Search), each with owned/missing status for this user, owned item ids, pairs-with ids, note, price band and sources.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        category: { type: Type.STRING, enum: [...CATEGORIES], description: "Optional category filter" },
        limit: { type: Type.INTEGER, minimum: 1, maximum: 20 },
      },
    },
  },
  {
    name: "research_trend_live",
    description:
      "A fresh live Google Search for a specific or very recent trend question (e.g. 'are barrel jeans still in?', 'what jewellery is trending for Diwali?'). Returns a summary and source keys (s1, s2…).",
    parameters: { type: Type.OBJECT, properties: { question: { type: Type.STRING } }, required: ["question"] },
  },
  {
    name: "shop_suggestions",
    description:
      "Turn items to buy into 'To buy' cards with real marketplace SEARCH links (Myntra, Ajio, Nykaa Fashion, Amazon), trend badges and price bands. Returns buy keys (b1, b2…) to show via respond_to_user. Never write links yourself.",
    parameters: { type: Type.OBJECT, properties: { gaps: { type: Type.ARRAY, items: GAP_ITEM } }, required: ["gaps"] },
  },
  {
    name: "save_to_wishlist",
    description: "Save a buy card (by key) to the user's wishlist. Only when the user asks to save it.",
    parameters: { type: Type.OBJECT, properties: { buy_key: { type: Type.STRING } }, required: ["buy_key"] },
  },
  {
    name: "save_outfit",
    description: "Save an outfit (by key) to the user's Lookbook and render its board. Only when the user asks to save it.",
    parameters: { type: Type.OBJECT, properties: { outfit_key: { type: Type.STRING } }, required: ["outfit_key"] },
  },
  {
    name: "respond_to_user",
    description: "Your final reply (REQUIRED to finish). Short friendly message plus cards: wardrobe items, outfits, buy suggestions, sources and follow-up chips.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        message: { type: Type.STRING, description: "3–6 sentences, markdown allowed" },
        item_ids: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Wardrobe item ids to show as 'From your wardrobe'" },
        outfits: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Outfit keys from build_outfits (o1…)" },
        custom_outfits: {
          type: Type.ARRAY,
          description: "Outfits you composed yourself from owned item ids (only if build_outfits wasn't used)",
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              style_tag: { type: Type.STRING },
              item_ids: { type: Type.ARRAY, items: { type: Type.STRING } },
              reasoning: { type: Type.STRING },
            },
            required: ["name", "item_ids"],
          },
        },
        buy_suggestions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Buy keys from shop_suggestions (b1…)" },
        sources: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Source keys (s1…) from get_trends / research_trend_live" },
        follow_up_chips: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2–3 short follow-up prompts" },
      },
      required: ["message"],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------
type Args = Record<string, unknown>;
const strArr = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);

function addSource(ctx: AgentContext, s: { title: string; url: string }) {
  for (const [k, v] of ctx.sources) if (v.url === s.url) return k;
  const key = `s${ctx.sources.size + 1}`;
  ctx.sources.set(key, s);
  return key;
}

function valuesOf(i: Item, k: string): string[] {
  const v = i[k as keyof Item];
  return Array.isArray(v) ? (v as string[]) : v ? [String(v)] : [];
}

export function searchWardrobe(wardrobe: Item[], filters: Record<string, string[]>, text?: string) {
  const keys = Object.keys(filters).filter((k) => filters[k]?.length);
  const words = (text ?? "").toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const textOk = (i: Item) => !words.length || words.every((w) => (i.description ?? "").toLowerCase().includes(w.replace(/s$/, "")));

  const exact: Item[] = [];
  const close: { item: Item; why: string }[] = [];
  for (const it of wardrobe) {
    const misses: string[] = [];
    const nearHits: string[] = [];
    for (const k of keys) {
      const have = valuesOf(it, k);
      const want = filters[k];
      if (k === "season" && have.includes("all_season")) continue;
      if (have.some((h) => want.includes(h))) continue;
      const near = have.find((h) => want.some((w) => neighboursOf(k, w).includes(h)));
      if (near) nearHits.push(`${labelize(near)} instead of ${want.map(labelize).join("/")}`);
      else misses.push(k);
    }
    if (!misses.length && !nearHits.length && textOk(it)) exact.push(it);
    else if (!misses.length && nearHits.length) close.push({ item: it, why: nearHits.join("; ") });
    else if (keys.length >= 2 && misses.length === 1 && !nearHits.length && textOk(it))
      close.push({ item: it, why: `matches everything except ${labelize(misses[0])}` });
  }
  return {
    wardrobe_size: wardrobe.length,
    exact: exact.slice(0, 25).map(compact),
    close: close.slice(0, 12).map((c) => ({ ...compact(c.item), why_close: c.why })),
  };
}

function outfitSummary(key: string, o: GeneratedOutfit) {
  return { key, name: o.name, style_tag: o.style_tag, items: o.items.map((i) => `${i.id} (${i.description})`), reasoning: o.reasoning, color_story: o.color_story };
}

const GROUP_FOR_CATEGORY: Record<string, GroupKey> = {
  topwear: "tops",
  bottomwear: "bottoms",
  dress: "dresses",
  ethnic_set: "ethnic",
  outerwear: "tops",
  footwear: "footwear",
  jewellery: "jewellery",
  bag: "bags",
  accessory: "bags",
  innerwear_activewear: "tops",
};

export async function runTool(name: string, args: Args, ctx: AgentContext): Promise<unknown> {
  const valid = new Set(ctx.wardrobe.map((i) => i.id));
  switch (name) {
    case "search_wardrobe": {
      ctx.progress("Checking your wardrobe…");
      const raw = (args.filters ?? {}) as Record<string, unknown>;
      const filters = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, strArr(v)]));
      return searchWardrobe(ctx.wardrobe, filters, args.text ? String(args.text) : undefined);
    }
    case "get_items": {
      const ids = strArr(args.ids).filter((id) => valid.has(id));
      return { items: ctx.wardrobe.filter((i) => ids.includes(i.id)).map((i) => ({ ...compact(i), fabric: i.fabric, length: i.length, season: i.season, aesthetic: i.aesthetic, size: i.size })) };
    }
    case "build_outfits":
    case "find_gaps": {
      ctx.progress(name === "build_outfits" ? "Building outfits from your closet…" : "Working out what's missing…");
      const anchor = args.anchor_item_id && valid.has(String(args.anchor_item_id)) ? String(args.anchor_item_id) : undefined;
      const mode = name === "find_gaps" ? (anchor ? "anchor" : "occasion") : args.mode === "anchor" && anchor ? "anchor" : "occasion";
      const r = await generateOutfits({
        mode,
        anchorItemId: mode === "anchor" ? anchor : undefined,
        occasion: args.occasion ? String(args.occasion) : undefined,
        weather: args.weather ? String(args.weather) : undefined,
        vibe: args.vibe ? String(args.vibe) : undefined,
        count: name === "find_gaps" ? 2 : Math.min(5, Number(args.count) || 3),
      });
      const keys: string[] = [];
      if (name === "build_outfits") {
        for (const o of r.outfits) {
          const key = `o${ctx.outfits.size + 1}`;
          ctx.outfits.set(key, o);
          keys.push(key);
        }
      }
      return {
        outfits: keys.map((k) => outfitSummary(k, ctx.outfits.get(k)!)),
        gaps: r.gaps.map((g) => ({ title: g.title, category: g.category, primary_color: g.attributes.primary_color, why: g.why, pairs_with_item_ids: g.pairs_with_item_ids })),
        note: r.note,
      };
    }
    case "get_trends": {
      const category = args.category ? normaliseValue(args.category, CATEGORIES, "") : "";
      let trends = await getCurrentTrends();
      const age = await newestTrendAgeHours();
      const group = category ? GROUP_FOR_CATEGORY[category] : undefined;
      const haveGroup = group ? trends.some((t) => t.group_key === group) : trends.length > 0;
      if (age > 72 || !haveGroup) {
        // Stale or missing: refresh just the relevant group (≈30s) rather than all 7.
        ctx.progress("Looking up what's trending right now…");
        await refreshGroup(group ?? "tops");
        await matchCurrentTrends();
        trends = await getCurrentTrends();
      } else ctx.progress("Checking this week's trends…");
      const picked = trends.filter((t) => !category || t.category === category).slice(0, Math.min(20, Number(args.limit) || 8));
      return {
        trends: picked.map((t) => ({
          title: t.title,
          category: t.category,
          heat: t.heat,
          status: t.status,
          owned_item_ids: t.owned_item_ids,
          pairs_with_item_ids: t.pairs_with_item_ids,
          note: t.note,
          summary: t.summary,
          how_to_style: t.how_to_style,
          price_band: t.price_band,
          sources: (t.sources ?? []).map((s) => addSource(ctx, s)),
        })),
      };
    }
    case "research_trend_live": {
      ctx.progress("Searching Google for the latest…");
      const q = String(args.question ?? "").slice(0, 300);
      const res = await generate(
        {
          contents: `You are a fashion trend analyst for ${ctx.profile.gender_pref || "women"} shoppers in India. Today is ${new Date().toDateString()}.
Use Google Search, then answer in 4–6 sentences with specific, shoppable details and Indian prices where relevant.
QUESTION: ${q}`,
          config: { tools: [{ googleSearch: {} }], temperature: 0.4 },
        },
        { label: "agent:research", timeoutMs: 60_000, thinkingLevel: "LOW" }
      );
      const chunks = res.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const keys: string[] = [];
      for (const c of chunks.slice(0, 5)) {
        if (!c.web?.uri) continue;
        let url = c.web.uri;
        try {
          const r = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(4000) });
          url = r.headers.get("location") ?? url;
        } catch {
          /* keep redirect */
        }
        keys.push(addSource(ctx, { title: c.web.title ?? new URL(url).hostname, url }));
      }
      return { summary: res.text ?? "", sources: keys };
    }
    case "shop_suggestions": {
      ctx.progress("Finding shop links…");
      const trends = await getLatestTrends().catch(() => []);
      const gaps = Array.isArray(args.gaps) ? (args.gaps as Args[]) : [];
      const out = gaps.slice(0, 4).map((g) => {
        const card = toBuyCard(
          {
            title: String(g.title ?? "").slice(0, 140),
            category: normaliseValue(g.category, CATEGORIES, "accessory"),
            attributes: g.primary_color ? { primary_color: normaliseValue(g.primary_color, COLORS, "multicolor") } : {},
            why: String(g.why ?? ""),
            pairs_with_item_ids: strArr(g.pairs_with_item_ids).filter((id) => valid.has(id)),
          },
          { genderPref: ctx.profile.gender_pref, budgetBand: ctx.profile.budget_band, trends }
        );
        const key = `b${ctx.buys.size + 1}`;
        ctx.buys.set(key, card);
        return { key, title: card.title, trending: card.trend ? `${card.trend.title} (heat ${card.trend.heat})` : null, price_band: card.price_band };
      });
      return { buy_cards: out };
    }
    case "save_to_wishlist": {
      const card = ctx.buys.get(String(args.buy_key));
      if (!card) return { error: "Unknown buy_key" };
      const r = await addToWishlist(card);
      return { saved: true, duplicate: r.duplicate };
    }
    case "save_outfit": {
      const o = ctx.outfits.get(String(args.outfit_key));
      if (!o) return { error: "Unknown outfit_key" };
      ctx.progress("Saving to your Lookbook…");
      const saved = await insertOutfit({ ...o, source: "agent" });
      try {
        const png = await renderBoard(o);
        await setOutfitBoard(saved.id, await putBlob(`boards/${saved.id}.png`, png, "image/png"));
      } catch (err) {
        console.warn("[agent] board render failed", (err as Error).message);
      }
      return { saved: true, outfit_id: saved.id };
    }
    default:
      return { error: `Unknown tool ${name}` };
  }
}

// ---------------------------------------------------------------------------
// respond_to_user → validated cards
// ---------------------------------------------------------------------------
export interface AgentCards {
  items: Item[];
  outfits: (Omit<GeneratedOutfit, "key"> & { key: string })[];
  buys: BuyCard[];
  sources: { title: string; url: string }[];
  chips: string[];
}

export async function buildCards(args: Args, ctx: AgentContext): Promise<AgentCards> {
  const byId = new Map(ctx.wardrobe.map((i) => [i.id, i]));
  const items = Array.from(new Set(strArr(args.item_ids)))
    .map((id) => byId.get(id))
    .filter((i): i is Item => !!i)
    .slice(0, 12);

  const outfits: AgentCards["outfits"] = [];
  for (const k of strArr(args.outfits)) {
    const o = ctx.outfits.get(k);
    if (o && !outfits.some((x) => x.key === o.key)) outfits.push(o);
  }
  // Outfits the model composed itself: only owned ids, must be a complete outfit.
  const custom = Array.isArray(args.custom_outfits) ? (args.custom_outfits as Args[]) : [];
  for (const [i, c] of custom.entries()) {
    const its = Array.from(new Set(strArr(c.item_ids))).map((id) => byId.get(id)).filter((x): x is Item => !!x);
    if (its.length < 2 || !hasBaseGarment(its)) continue;
    outfits.push({
      key: `c${Date.now().toString(36)}${i}`,
      name: String(c.name ?? "Outfit"),
      style_tag: String(c.style_tag ?? "").toLowerCase(),
      occasion: null,
      item_ids: its.map((x) => x.id),
      reasoning: String(c.reasoning ?? ""),
      missing_piece: null,
      color_story: "",
      items: its,
    });
  }

  const buys = strArr(args.buy_suggestions).map((k) => ctx.buys.get(k)).filter((b): b is BuyCard => !!b);
  const sources = strArr(args.sources).map((k) => ctx.sources.get(k)).filter((s): s is { title: string; url: string } => !!s);
  const chips = strArr(args.follow_up_chips).map((c) => c.slice(0, 60)).slice(0, 3);
  return { items, outfits: outfits.slice(0, 5), buys: buys.slice(0, 4), sources: sources.slice(0, 6), chips };
}

