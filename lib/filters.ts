import type { Item } from "./types";
import { labelize } from "./utils";

/**
 * Wardrobe filtering (client-side: a personal wardrobe is < 500 items).
 * Within a group values are OR'ed; across groups they are AND'ed.
 * Array attributes (occasion, season, aesthetic) match if any value overlaps.
 */

export type FilterKey =
  | "category"
  | "subcategory"
  | "primary_color"
  | "pattern"
  | "sleeve_length"
  | "neckline"
  | "fit"
  | "length"
  | "fabric"
  | "occasion"
  | "season"
  | "style"
  | "aesthetic"
  | "metal_tone"
  | "size";

export const FILTER_GROUPS: { key: FilterKey; label: string }[] = [
  { key: "category", label: "Category" },
  { key: "subcategory", label: "Type" },
  { key: "primary_color", label: "Colour" },
  { key: "pattern", label: "Pattern" },
  { key: "sleeve_length", label: "Sleeve length" },
  { key: "neckline", label: "Neckline" },
  { key: "fit", label: "Fit" },
  { key: "length", label: "Length" },
  { key: "fabric", label: "Fabric" },
  { key: "occasion", label: "Occasion" },
  { key: "season", label: "Season" },
  { key: "style", label: "Style" },
  { key: "aesthetic", label: "Aesthetic" },
  { key: "metal_tone", label: "Metal tone" },
  { key: "size", label: "Size" },
];

/** Values that mean "doesn't apply" are hidden from the filter chips. */
const HIDDEN_VALUES = new Set(["not_applicable", "unknown", "other", ""]);

export interface Filters {
  selected: Partial<Record<FilterKey, string[]>>;
  formality: [number, number];
  search: string;
}

export const EMPTY_FILTERS: Filters = { selected: {}, formality: [1, 5], search: "" };

function valuesOf(item: Item, key: FilterKey): string[] {
  const v = item[key as keyof Item];
  if (Array.isArray(v)) return v as string[];
  if (v === null || v === undefined) return [];
  // An item tagged "all_season" counts for every season.
  return [String(v)];
}

function matchesGroup(item: Item, key: FilterKey, wanted: string[]) {
  if (!wanted.length) return true;
  const have = valuesOf(item, key);
  if (key === "season" && have.includes("all_season")) return true;
  if (key === "size") return have.some((h) => wanted.some((w) => h.toLowerCase() === w.toLowerCase()));
  return have.some((h) => wanted.includes(h));
}

/** Searchable text for an item: description + every attribute, in plain words. */
function haystack(item: Item) {
  const parts = [
    item.description,
    item.brand_visible,
    item.size,
    item.category,
    item.subcategory,
    item.primary_color,
    ...item.secondary_colors,
    item.pattern,
    item.sleeve_length,
    item.neckline,
    item.fit,
    item.length,
    item.fabric,
    item.wash,
    item.embellishment,
    item.style,
    item.metal_tone,
    ...item.occasion,
    ...item.season,
    ...item.aesthetic,
  ];
  return parts
    .filter(Boolean)
    .map((p) => labelize(String(p)).toLowerCase())
    .join(" ")
    .replace(/-/g, " ");
}

function matchesSearch(item: Item, search: string) {
  const q = search.trim().toLowerCase().replace(/-/g, " ");
  if (!q) return true;
  const text = haystack(item);
  // Every word must appear (simple plural tolerance: "tops" matches "top").
  return q.split(/\s+/).every((w) => text.includes(w) || (w.endsWith("s") && text.includes(w.slice(0, -1))));
}

function matchesFormality(item: Item, [lo, hi]: [number, number]) {
  if (lo <= 1 && hi >= 5) return true;
  const f = item.formality ?? 2;
  return f >= lo && f <= hi;
}

/** Apply all filters, optionally ignoring one group (used for facet counts). */
export function applyFilters(items: Item[], f: Filters, ignore?: FilterKey) {
  return items.filter(
    (it) =>
      matchesSearch(it, f.search) &&
      matchesFormality(it, f.formality) &&
      FILTER_GROUPS.every(({ key }) => key === ignore || matchesGroup(it, key, f.selected[key] ?? []))
  );
}

/**
 * Facet counts per group: how many items each value would show, given every OTHER active filter.
 * Only values present in the wardrobe are returned, most common first.
 */
export function facetCounts(items: Item[], f: Filters) {
  const out = {} as Record<FilterKey, { value: string; count: number }[]>;
  for (const { key } of FILTER_GROUPS) {
    const pool = applyFilters(items, f, key);
    const counts = new Map<string, number>();
    for (const it of pool) {
      for (const v of new Set(valuesOf(it, key))) {
        if (HIDDEN_VALUES.has(v)) continue;
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
    }
    // Keep selected values visible even if they now have 0 results.
    for (const v of f.selected[key] ?? []) if (!counts.has(v)) counts.set(v, 0);
    out[key] = [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  }
  // Subcategories only make sense within the chosen categories.
  const cats = f.selected.category ?? [];
  if (cats.length) {
    const allowed = new Set(items.filter((i) => cats.includes(i.category)).map((i) => i.subcategory));
    out.subcategory = out.subcategory.filter((s) => allowed.has(s.value) || (f.selected.subcategory ?? []).includes(s.value));
  }
  return out;
}

export function activeCount(f: Filters) {
  return (
    Object.values(f.selected).reduce((n, v) => n + (v?.length ?? 0), 0) +
    (f.formality[0] > 1 || f.formality[1] < 5 ? 1 : 0) +
    (f.search.trim() ? 1 : 0)
  );
}

// --- URL <-> filters, so links like /wardrobe?category=bottomwear&primary_color=black work ---
export function filtersFromParams(params: URLSearchParams): Filters {
  const selected: Filters["selected"] = {};
  for (const { key } of FILTER_GROUPS) {
    const v = params.get(key);
    if (v) selected[key] = v.split(",").filter(Boolean);
  }
  const fl = params.get("formality")?.split("-").map(Number);
  return {
    selected,
    formality: fl && fl.length === 2 && fl.every((n) => n >= 1 && n <= 5) ? [fl[0], fl[1]] : [1, 5],
    search: params.get("q") ?? "",
  };
}

export function filtersToParams(f: Filters) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f.selected)) if (v?.length) p.set(k, v.join(","));
  if (f.formality[0] > 1 || f.formality[1] < 5) p.set("formality", `${f.formality[0]}-${f.formality[1]}`);
  if (f.search.trim()) p.set("q", f.search.trim());
  return p;
}
