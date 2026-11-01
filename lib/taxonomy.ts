/**
 * Closet attribute taxonomy: the single source of truth for every "filter".
 * Used by: the extraction prompt, Gemini responseSchema enums, zod validation,
 * the filter UI, the trend parser and the agent's tools.
 */

export const CATEGORIES = [
  "topwear",
  "bottomwear",
  "dress",
  "ethnic_set",
  "outerwear",
  "footwear",
  "bag",
  "jewellery",
  "accessory",
  "innerwear_activewear",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const SUBCATEGORIES_BY_CATEGORY = {
  topwear: ["t-shirt", "shirt", "blouse", "crop_top", "tank_top", "camisole", "sweater", "sweatshirt", "hoodie", "kurta", "kurti", "tunic", "bodysuit", "corset_top"],
  bottomwear: ["jeans", "trousers", "chinos", "cargo", "joggers", "shorts", "skirt", "palazzo", "leggings", "salwar", "churidar", "dhoti_pants", "sharara"],
  dress: ["mini_dress", "midi_dress", "maxi_dress", "shirt_dress", "bodycon", "jumpsuit", "co-ord_set"],
  ethnic_set: ["saree", "lehenga", "anarkali", "kurta_set"],
  outerwear: ["jacket", "denim_jacket", "blazer", "shrug", "cardigan", "coat", "nehru_jacket", "dupatta"],
  footwear: ["sneakers", "heels", "flats", "sandals", "boots", "loafers", "juttis", "kolhapuris", "flip_flops"],
  bag: ["tote", "sling", "clutch", "backpack", "potli", "handbag"],
  jewellery: ["earrings", "necklace", "bangles", "bracelet", "ring", "anklet", "maang_tikka"],
  accessory: ["belt", "watch", "sunglasses", "scarf", "cap_hat", "hair_accessory"],
  innerwear_activewear: ["sports_bra", "activewear_top", "activewear_bottom", "other"],
} as const satisfies Record<Category, readonly string[]>;

// Unique flat list (some names like "bodycon" appear once only, but dedupe defensively).
export const SUBCATEGORIES = Array.from(new Set([...Object.values(SUBCATEGORIES_BY_CATEGORY).flat(), "other"])) as string[];

export const COLORS = [
  "black", "white", "off_white", "cream", "beige", "brown", "tan", "grey", "navy", "blue",
  "light_blue", "teal", "green", "olive", "mint", "yellow", "mustard", "orange", "rust", "red",
  "maroon", "pink", "peach", "lavender", "purple", "magenta", "gold", "silver", "multicolor",
] as const;

/** Swatch hex per colour for the filter UI. */
export const COLOR_SWATCH: Record<(typeof COLORS)[number], string> = {
  black: "#1a1a1a", white: "#ffffff", off_white: "#f7f3ea", cream: "#f2e6c9", beige: "#d9c7a7",
  brown: "#6b4226", tan: "#c49a6c", grey: "#8c8c8c", navy: "#1f2a4d", blue: "#2f5fd0",
  light_blue: "#9cc3ec", teal: "#1f8a8a", green: "#2e7d32", olive: "#6b7031", mint: "#b8e6cf",
  yellow: "#f4d03f", mustard: "#d4a017", orange: "#ec7a1c", rust: "#b5532a", red: "#d0312d",
  maroon: "#7a1f2b", pink: "#f2a5c0", peach: "#f6c3a4", lavender: "#c7b6e8", purple: "#6a3fa0",
  magenta: "#c2185b", gold: "#d4af37", silver: "#c0c0c0",
  multicolor: "conic-gradient(#d0312d, #f4d03f, #2e7d32, #2f5fd0, #6a3fa0, #d0312d)",
};

export const PATTERNS = [
  "solid", "striped", "checked", "plaid", "floral", "block_print", "bandhani", "ikat", "paisley",
  "polka_dot", "geometric", "abstract", "graphic_print", "typography", "animal_print", "tie_dye",
  "camouflage", "ombre", "embroidered", "sequinned", "self_design", "colorblock", "lace", "mesh_net", "crochet",
] as const;

export const SLEEVE_LENGTHS = ["sleeveless", "strapless", "cap", "short", "elbow", "three_quarter", "long", "not_applicable"] as const;

export const SLEEVE_STYLES = ["regular", "puff", "bell", "flutter", "raglan", "cold_shoulder", "bishop", "roll_up", "not_applicable"] as const;

export const NECKLINES = [
  "round", "v_neck", "collar", "mandarin", "boat", "square", "sweetheart", "halter", "off_shoulder",
  "one_shoulder", "turtle", "high_neck", "scoop", "keyhole", "cowl", "hooded", "not_applicable",
] as const;

export const FITS = [
  "slim", "skinny", "regular", "relaxed", "oversized", "boxy", "bodycon", "a_line", "flared",
  "straight", "wide_leg", "bootcut", "tapered", "mom", "baggy", "barrel",
] as const;

export const LENGTHS_BY_GROUP = {
  tops: ["cropped", "regular", "longline", "tunic"],
  bottoms: ["shorts", "capri", "ankle", "full"],
  dresses_skirts: ["mini", "knee", "midi", "maxi"],
} as const;
// "regular" etc. only once; plus not_applicable.
export const LENGTHS = Array.from(new Set([...Object.values(LENGTHS_BY_GROUP).flat(), "not_applicable"])) as string[];

export const RISES = ["low", "mid", "high", "not_applicable"] as const;

export const FABRICS = [
  "cotton", "denim", "linen", "silk", "satin", "chiffon", "georgette", "crepe", "rayon", "polyester",
  "wool", "knit", "crochet", "fleece", "leather", "faux_leather", "suede", "velvet", "net", "lace",
  "mesh", "organza", "chanderi", "khadi", "jersey", "corduroy", "unknown",
] as const;

export const WASHES = ["light", "medium", "dark", "black", "grey", "distressed", "not_applicable"] as const;

export const EMBELLISHMENTS = [
  "none", "embroidery", "sequins", "mirror_work", "zari", "beads", "lace_trim", "ruffles", "bows", "studs", "cutouts", "prints_only",
] as const;

export const STYLES = ["western", "ethnic", "indo_western", "athleisure", "formal"] as const;

export const OCCASIONS = [
  "casual", "college", "work", "formal", "party", "date", "festive", "wedding", "beach", "travel", "sports", "lounge",
] as const;

export const SEASONS = ["summer", "monsoon", "winter", "all_season"] as const;

export const AESTHETICS = [
  "minimal", "classic", "boho", "streetwear", "y2k", "korean", "preppy", "old_money", "quiet_luxury",
  "coquette", "balletcore", "edgy", "romantic", "desi_chic", "sporty",
] as const;

export const METAL_TONES = ["gold", "silver", "rose_gold", "oxidised", "kundan", "pearl", "mixed", "not_applicable"] as const;

export const FORMALITY_MIN = 1;
export const FORMALITY_MAX = 5;

/** Single-value enum attributes (key -> allowed values). */
export const SINGLE_ATTRS = {
  category: CATEGORIES as readonly string[],
  subcategory: SUBCATEGORIES,
  primary_color: COLORS as readonly string[],
  pattern: PATTERNS as readonly string[],
  sleeve_length: SLEEVE_LENGTHS as readonly string[],
  sleeve_style: SLEEVE_STYLES as readonly string[],
  neckline: NECKLINES as readonly string[],
  fit: FITS as readonly string[],
  length: LENGTHS,
  rise: RISES as readonly string[],
  fabric: FABRICS as readonly string[],
  wash: WASHES as readonly string[],
  embellishment: EMBELLISHMENTS as readonly string[],
  style: STYLES as readonly string[],
  metal_tone: METAL_TONES as readonly string[],
} as const;

/** Multi-value enum attributes (stored as text[]). */
export const MULTI_ATTRS = {
  secondary_colors: COLORS as readonly string[],
  occasion: OCCASIONS as readonly string[],
  season: SEASONS as readonly string[],
  aesthetic: AESTHETICS as readonly string[],
} as const;

export type SingleAttr = keyof typeof SINGLE_ATTRS;
export type MultiAttr = keyof typeof MULTI_ATTRS;

/** Compact JSON of every allowed value, injected into prompts as {{TAXONOMY_JSON}}. */
export function taxonomyForPrompt() {
  return JSON.stringify(
    {
      category: CATEGORIES,
      subcategory_by_category: SUBCATEGORIES_BY_CATEGORY,
      primary_color: COLORS,
      secondary_colors: "array of primary_color values",
      primary_color_hex: "hex estimated from the item, e.g. #1a1a1a",
      pattern: PATTERNS,
      sleeve_length: SLEEVE_LENGTHS,
      sleeve_style: SLEEVE_STYLES,
      neckline: NECKLINES,
      fit: FITS,
      length: { ...LENGTHS_BY_GROUP, other: ["not_applicable"] },
      rise: RISES,
      fabric: FABRICS,
      wash: { values: WASHES, note: "denim only, else not_applicable" },
      embellishment: EMBELLISHMENTS,
      style: STYLES,
      occasion: { values: OCCASIONS, note: "array" },
      season: { values: SEASONS, note: "array" },
      formality: "integer 1 (very casual) to 5 (very formal)",
      aesthetic: { values: AESTHETICS, note: "array" },
      metal_tone: { values: METAL_TONES, note: "jewellery only, else not_applicable" },
      brand_visible: "brand name if a logo/label is readable, else null",
      size: "null unless a size label is clearly readable",
      description: "one natural sentence",
      confidence: "0 to 1",
    },
    null,
    0
  );
}

// ---------------------------------------------------------------------------
// Normalising unknown values ("closest value or other")
// ---------------------------------------------------------------------------

const SYNONYMS: Record<string, string> = {
  // colours
  gray: "grey", charcoal: "grey", ivory: "off_white", "off-white": "off_white", offwhite: "off_white",
  khaki: "beige", camel: "tan", nude: "beige", burgundy: "maroon", wine: "maroon", fuchsia: "magenta",
  violet: "purple", lilac: "lavender", coral: "peach", "sky_blue": "light_blue", "baby_blue": "light_blue",
  turquoise: "teal", "dark_green": "green", "bottle_green": "green", "sage": "mint", "rose_gold": "gold",
  "multi": "multicolor", "multicolour": "multicolor", "multi_color": "multicolor", "printed": "multicolor",
  // subcategories
  tshirt: "t-shirt", tee: "t-shirt", t_shirt: "t-shirt", top: "blouse", jumper: "sweater", pullover: "sweater",
  pants: "trousers", trouser: "trousers", jeggings: "leggings", coord: "co-ord_set", co_ord_set: "co-ord_set",
  "co-ord": "co-ord_set", shoes: "sneakers", trainers: "sneakers", sandal: "sandals", sneaker: "sneakers",
  earring: "earrings", bangle: "bangles", purse: "handbag", "sling_bag": "sling", "cross_body": "sling",
  sunglass: "sunglasses", hat: "cap_hat", cap: "cap_hat",
  // misc
  "full_sleeve": "long", "half_sleeve": "short", "3/4": "three_quarter", "vneck": "v_neck", "v-neck": "v_neck",
  "crew": "round", "crew_neck": "round", polo: "collar", "wide-leg": "wide_leg", "a-line": "a_line",
};

/** Map a free-text value to the closest allowed value, or "other"/fallback. */
export function normaliseValue(value: unknown, allowed: readonly string[], fallback = "other"): string {
  if (value === null || value === undefined) return fallback;
  const raw = String(value).trim().toLowerCase().replace(/\s+/g, "_");
  if (allowed.includes(raw)) return raw;
  const hy = raw.replace(/_/g, "-");
  if (allowed.includes(hy)) return hy;
  const syn = SYNONYMS[raw] ?? SYNONYMS[hy];
  if (syn && allowed.includes(syn)) return syn;
  // plural / singular
  if (allowed.includes(raw + "s")) return raw + "s";
  if (raw.endsWith("s") && allowed.includes(raw.slice(0, -1))) return raw.slice(0, -1);
  // substring match ("dark_navy" -> "navy")
  const hit = allowed.find((a) => a !== "other" && (raw.includes(a) || a.includes(raw)));
  if (hit) return hit;
  return allowed.includes(fallback) ? fallback : allowed.includes("other") ? "other" : allowed.includes("not_applicable") ? "not_applicable" : allowed[0];
}

export function normaliseArray(values: unknown, allowed: readonly string[]): string[] {
  if (!Array.isArray(values)) return [];
  const out = values
    .map((v) => normaliseValue(v, allowed, "__drop__"))
    .filter((v) => v !== "__drop__" && allowed.includes(v));
  return Array.from(new Set(out));
}

/** Which category a subcategory belongs to (or null). */
export function categoryOfSubcategory(sub: string): Category | null {
  for (const c of CATEGORIES) {
    if ((SUBCATEGORIES_BY_CATEGORY[c] as readonly string[]).includes(sub)) return c;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Neighbour maps for fuzzy matching (symmetric: declare once, used both ways)
// ---------------------------------------------------------------------------

function symmetric(pairs: Record<string, string[]>): Record<string, string[]> {
  const out: Record<string, Set<string>> = {};
  for (const [k, vs] of Object.entries(pairs)) {
    for (const v of vs) {
      (out[k] ??= new Set()).add(v);
      (out[v] ??= new Set()).add(k);
    }
  }
  return Object.fromEntries(Object.entries(out).map(([k, s]) => [k, Array.from(s)]));
}

export const COLOR_NEIGHBOURS = symmetric({
  red: ["maroon", "rust", "magenta"],
  maroon: ["rust", "brown"],
  navy: ["blue", "black"],
  blue: ["light_blue", "teal"],
  cream: ["off_white", "beige"],
  off_white: ["white"],
  beige: ["tan"],
  tan: ["brown", "mustard"],
  brown: ["rust"],
  grey: ["silver", "black"],
  green: ["olive", "teal", "mint"],
  yellow: ["mustard", "gold"],
  orange: ["rust", "peach"],
  pink: ["peach", "magenta", "lavender"],
  purple: ["lavender", "magenta"],
  gold: ["mustard"],
});

export const SLEEVE_NEIGHBOURS = symmetric({
  long: ["three_quarter"],
  three_quarter: ["elbow"],
  short: ["cap", "elbow"],
  sleeveless: ["strapless", "cap"],
});

export const FIT_NEIGHBOURS = symmetric({
  wide_leg: ["flared", "baggy", "palazzo_like"],
  flared: ["bootcut", "a_line"],
  slim: ["skinny", "tapered"],
  regular: ["straight"],
  relaxed: ["oversized", "baggy", "boxy"],
  mom: ["straight", "tapered"],
  barrel: ["baggy", "wide_leg"],
  bodycon: ["slim"],
});

export const NECKLINE_NEIGHBOURS = symmetric({
  round: ["scoop", "boat"],
  v_neck: ["sweetheart"],
  collar: ["mandarin"],
  high_neck: ["turtle", "mandarin"],
  off_shoulder: ["one_shoulder"],
});

export const PATTERN_NEIGHBOURS = symmetric({
  block_print: ["paisley", "floral", "bandhani", "ikat"],
  striped: ["checked"],
  checked: ["plaid"],
  lace: ["mesh_net", "crochet"],
  embroidered: ["self_design"],
  sequinned: ["embroidered"],
  abstract: ["geometric", "graphic_print"],
  graphic_print: ["typography"],
});

export const SUBCATEGORY_NEIGHBOURS = symmetric({
  "t-shirt": ["tank_top", "crop_top"],
  blouse: ["shirt", "camisole", "crop_top"],
  crop_top: ["tank_top", "camisole", "corset_top", "bodysuit"],
  kurta: ["kurti", "tunic"],
  sweater: ["sweatshirt", "cardigan"],
  sweatshirt: ["hoodie"],
  jeans: ["trousers"],
  trousers: ["chinos"],
  palazzo: ["sharara", "trousers"],
  heels: ["sandals"],
  flats: ["juttis", "kolhapuris", "sandals"],
  sneakers: ["loafers"],
  tote: ["handbag"],
  sling: ["clutch", "handbag"],
  jacket: ["denim_jacket", "blazer"],
  shrug: ["cardigan"],
});

export const NEIGHBOURS: Partial<Record<SingleAttr | "secondary_colors", Record<string, string[]>>> = {
  primary_color: COLOR_NEIGHBOURS,
  secondary_colors: COLOR_NEIGHBOURS,
  sleeve_length: SLEEVE_NEIGHBOURS,
  fit: FIT_NEIGHBOURS,
  neckline: NECKLINE_NEIGHBOURS,
  pattern: PATTERN_NEIGHBOURS,
  subcategory: SUBCATEGORY_NEIGHBOURS,
};

/** Values considered "close" to `value` for `attr` (excluding the value itself). */
export function neighboursOf(attr: string, value: string): string[] {
  const map = NEIGHBOURS[attr as keyof typeof NEIGHBOURS];
  return map?.[value] ?? [];
}

// ---------------------------------------------------------------------------
// Profile options
// ---------------------------------------------------------------------------

export const GENDER_PREFS = ["women", "men", "unisex"] as const;
export const BUDGET_BANDS = [
  { value: "budget", label: "Budget (under ₹1,000)" },
  { value: "mid", label: "Mid (₹1,000–3,000)" },
  { value: "premium", label: "Premium (₹3,000+)" },
] as const;
