/** A wardrobe item row (DB shape). */
export interface Item {
  id: string;
  upload_id: string | null;
  cutout_url: string | null;
  crop_url: string;
  cutout_method: CutoutMethod | null;
  bbox: BBox | null;
  category: string;
  subcategory: string | null;
  primary_color: string | null;
  primary_color_hex: string | null;
  secondary_colors: string[];
  pattern: string | null;
  sleeve_length: string | null;
  sleeve_style: string | null;
  neckline: string | null;
  fit: string | null;
  length: string | null;
  rise: string | null;
  fabric: string | null;
  wash: string | null;
  embellishment: string | null;
  style: string | null;
  metal_tone: string | null;
  occasion: string[];
  season: string[];
  formality: number | null;
  aesthetic: string[];
  brand_visible: string | null;
  size: string | null;
  description: string | null;
  confidence: number | null;
  user_edited: boolean;
  times_suggested: number;
  created_at: string;
}

/**
 * gemini_mask        – Gemini segmentation mask applied to the real photo
 * ai_product_shot    – Gemini image model re-draws the item as a product shot (worn items)
 * browser_bg_removal – @imgly/background-removal in the browser (real pixels)
 * crop_only          – padded rectangle crop, no cutout
 */
export type CutoutMethod = "gemini_mask" | "ai_product_shot" | "browser_bg_removal" | "crop_only";

/** Normalised 0..1 box. */
export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Upload {
  id: string;
  original_url: string;
  width: number | null;
  height: number | null;
  created_at: string;
}

/** Item as returned by the upload API, with a hint for the client. */
export interface UploadedItem extends Item {
  needs_client_cutout: boolean;
}

export interface Outfit {
  id: string;
  name: string | null;
  style_tag: string | null;
  occasion: string | null;
  reasoning: string | null;
  missing_piece: string | null;
  color_story: string | null;
  item_ids: string[];
  board_url: string | null;
  source: string | null;
  is_favorite: boolean;
  created_at: string;
}

export interface ShopLinks {
  myntra: string;
  ajio: string;
  nykaa: string;
  amazon: string;
}

/** A trend summary attached to a buy card when the item matches a current trend. */
export interface TrendBadge {
  id: string;
  title: string;
  heat: number;
  sources: { title: string; url: string }[];
}

/** A "To buy" suggestion (from an outfit gap, a trend, or the stylist agent). */
export interface BuyCard {
  title: string;
  category: string;
  attributes: Record<string, string>;
  why: string;
  pairs_with_item_ids: string[];
  search_query: string;
  links: ShopLinks;
  price_band: string;
  trend: TrendBadge | null;
}

export interface WishlistItem {
  id: string;
  title: string;
  category: string | null;
  attributes: Record<string, string> | null;
  why: string | null;
  pairs_with_item_ids: string[];
  trend_id: string | null;
  search_query: string | null;
  price_band: string | null;
  bought: boolean;
  created_at: string;
}

export interface Trend {
  id: string;
  batch_id: string;
  period: string;
  title: string;
  category: string | null;
  match_attributes: Record<string, string[]> | null;
  summary: string | null;
  why_now: string | null;
  how_to_style: string | null;
  heat: number | null;
  price_band: string | null;
  search_query: string | null;
  sources: { title: string; url: string }[] | null;
  created_at: string;
}
