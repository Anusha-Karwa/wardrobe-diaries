import type { Gap } from "./outfits";
import type { BuyCard, ShopLinks, Trend } from "./types";

/**
 * Shopping engine (spec 6j). Turns a gap or trend into a "To buy" card.
 * No scraping and no made-up product URLs: only marketplace SEARCH links built from a query.
 */

const GENDER_WORD: Record<string, string> = { women: "women", men: "men", unisex: "" };

/** Lowercase, plain words only, gender word added once. "White Halter-Neck Lace Top" → "white halter neck lace top women" */
export function buildSearchQuery(text: string, genderPref = "women") {
  const words = text
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const g = GENDER_WORD[genderPref] ?? "women";
  const hasGender = words.some((w) => /^(women|womens|woman|men|mens|man|girls|boys|unisex)$/.test(w));
  if (g && !hasGender) words.push(g);
  return words.join(" ").slice(0, 120).trim();
}

export function shopLinks(query: string): ShopLinks {
  const q = query.trim().toLowerCase();
  const enc = encodeURIComponent(q);
  return {
    myntra: `https://www.myntra.com/${q.replace(/\s+/g, "-")}`,
    ajio: `https://www.ajio.com/search/?text=${enc}`,
    nykaa: `https://www.nykaafashion.com/catalogsearch/result/?q=${enc}`,
    amazon: `https://www.amazon.in/s?k=${enc}`,
  };
}

export const BUDGET_LABEL: Record<string, string> = {
  budget: "Under ₹1,000",
  mid: "₹1,000–3,000",
  premium: "₹3,000+",
};

/** Overlap score between an item's attributes and a trend's match_attributes (0 = no match). */
export function trendScore(category: string, attrs: Record<string, string>, title: string, trend: Trend) {
  if (trend.category && trend.category !== category) return 0;
  const m = trend.match_attributes ?? {};
  const keys = Object.keys(m).filter((k) => m[k]?.length);
  if (!keys.length) return 0;
  let hits = 0;
  for (const k of keys) {
    const want = m[k];
    if (attrs[k] && want.includes(attrs[k])) hits++;
    // Fall back to the title words (e.g. "halter" in "white halter-neck lace top").
    else if (want.some((v) => title.toLowerCase().includes(v.replace(/_/g, " ").replace(/-/g, " ").split(" ")[0]))) hits += 0.5;
  }
  // Need the defining attribute(s) to match, not just the category.
  return hits / keys.length >= 0.5 ? hits / keys.length : 0;
}

export function toBuyCard(
  gap: Pick<Gap, "title" | "category" | "attributes" | "why" | "pairs_with_item_ids">,
  opts: { genderPref?: string; budgetBand?: string; trends?: Trend[]; trendHint?: Trend | null } = {}
): BuyCard {
  // Best-matching current trend, if any.
  let trend: Trend | null = opts.trendHint ?? null;
  if (!trend && opts.trends?.length) {
    let best = 0;
    for (const t of opts.trends) {
      const s = trendScore(gap.category, gap.attributes, gap.title, t);
      if (s > best) [best, trend] = [s, t];
    }
  }
  const search_query = buildSearchQuery(gap.title, opts.genderPref);
  return {
    title: gap.title,
    category: gap.category,
    attributes: gap.attributes,
    why: gap.why,
    pairs_with_item_ids: gap.pairs_with_item_ids,
    search_query,
    links: shopLinks(search_query),
    price_band: trend?.price_band || BUDGET_LABEL[opts.budgetBand ?? "mid"] || BUDGET_LABEL.mid,
    trend: trend
      ? { id: trend.id, title: trend.title, heat: trend.heat ?? 3, sources: (trend.sources ?? []).slice(0, 3) }
      : null,
  };
}
