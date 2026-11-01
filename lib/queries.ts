import { sql } from "./db";

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------
export interface Profile {
  name: string | null;
  gender_pref: string;
  city: string;
  budget_band: string;
  aesthetics: string[];
  notes: string | null;
  updated_at?: string;
}

const DEFAULT_PROFILE: Profile = {
  name: null,
  gender_pref: "women",
  city: "Bengaluru",
  budget_band: "mid",
  aesthetics: [],
  notes: null,
};

export async function getProfile(): Promise<Profile> {
  const rows = await sql`select name, gender_pref, city, budget_band, aesthetics, notes, updated_at from profile where id = 1`;
  return rows[0] ? { ...DEFAULT_PROFILE, ...(rows[0] as Profile) } : DEFAULT_PROFILE;
}

export async function saveProfile(p: Profile) {
  await sql`
    insert into profile (id, name, gender_pref, city, budget_band, aesthetics, notes, updated_at)
    values (1, ${p.name}, ${p.gender_pref}, ${p.city}, ${p.budget_band}, ${p.aesthetics}, ${p.notes}, now())
    on conflict (id) do update set
      name = excluded.name,
      gender_pref = excluded.gender_pref,
      city = excluded.city,
      budget_band = excluded.budget_band,
      aesthetics = excluded.aesthetics,
      notes = excluded.notes,
      updated_at = now()`;
}

// ---------------------------------------------------------------------------
// Uploads & items
// ---------------------------------------------------------------------------
import type { BBox, CutoutMethod, Item, Upload } from "./types";
import type { ItemAttributes } from "./extraction/attributes";
import { deleteBlobs } from "./blob";

export async function insertUpload(u: { id: string; original_url: string; width: number; height: number; content_hash?: string | null }) {
  const rows = await sql`
    insert into uploads (id, original_url, width, height, content_hash)
    values (${u.id}, ${u.original_url}, ${u.width}, ${u.height}, ${u.content_hash ?? null})
    returning id, original_url, width, height, created_at`;
  return rows[0] as Upload;
}

export async function findUploadByHash(hash: string) {
  const rows = await sql`select id from uploads where content_hash = ${hash} limit 1`;
  return (rows[0]?.id as string | undefined) ?? null;
}

export async function getUpload(id: string) {
  const rows = await sql`select id, original_url, width, height, created_at from uploads where id = ${id}`;
  return (rows[0] as Upload | undefined) ?? null;
}

export async function insertItem(row: {
  id: string;
  upload_id: string;
  cutout_url: string | null;
  crop_url: string;
  cutout_method: CutoutMethod | null;
  bbox: BBox;
  attrs: ItemAttributes;
}) {
  const a = row.attrs;
  const rows = await sql`
    insert into items (
      id, upload_id, cutout_url, crop_url, cutout_method, bbox,
      category, subcategory, primary_color, primary_color_hex, secondary_colors,
      pattern, sleeve_length, sleeve_style, neckline, fit, length, rise, fabric, wash,
      embellishment, style, metal_tone, occasion, season, formality, aesthetic,
      brand_visible, size, description, confidence
    ) values (
      ${row.id}, ${row.upload_id}, ${row.cutout_url}, ${row.crop_url}, ${row.cutout_method}, ${JSON.stringify(row.bbox)}::jsonb,
      ${a.category}, ${a.subcategory}, ${a.primary_color}, ${a.primary_color_hex}, ${a.secondary_colors},
      ${a.pattern}, ${a.sleeve_length}, ${a.sleeve_style}, ${a.neckline}, ${a.fit}, ${a.length}, ${a.rise}, ${a.fabric}, ${a.wash},
      ${a.embellishment}, ${a.style}, ${a.metal_tone}, ${a.occasion}, ${a.season}, ${a.formality}, ${a.aesthetic},
      ${a.brand_visible}, ${a.size}, ${a.description}, ${a.confidence}
    ) returning *`;
  return rows[0] as Item;
}

export async function getItem(id: string) {
  const rows = await sql`select * from items where id = ${id}`;
  return (rows[0] as Item | undefined) ?? null;
}

export async function listItems() {
  return (await sql`select * from items order by created_at desc`) as Item[];
}

export async function updateItemAttributes(id: string, a: ItemAttributes) {
  const rows = await sql`
    update items set
      category = ${a.category}, subcategory = ${a.subcategory}, primary_color = ${a.primary_color},
      primary_color_hex = ${a.primary_color_hex}, secondary_colors = ${a.secondary_colors},
      pattern = ${a.pattern}, sleeve_length = ${a.sleeve_length}, sleeve_style = ${a.sleeve_style},
      neckline = ${a.neckline}, fit = ${a.fit}, length = ${a.length}, rise = ${a.rise}, fabric = ${a.fabric},
      wash = ${a.wash}, embellishment = ${a.embellishment}, style = ${a.style}, metal_tone = ${a.metal_tone},
      occasion = ${a.occasion}, season = ${a.season}, formality = ${a.formality}, aesthetic = ${a.aesthetic},
      brand_visible = ${a.brand_visible}, size = ${a.size}, description = ${a.description},
      user_edited = true
    where id = ${id} returning *`;
  return (rows[0] as Item | undefined) ?? null;
}

export async function setItemCutout(id: string, cutoutUrl: string | null, method: CutoutMethod) {
  const rows = await sql`update items set cutout_url = ${cutoutUrl}, cutout_method = ${method} where id = ${id} returning *`;
  return (rows[0] as Item | undefined) ?? null;
}

/** Deletes the item and its blobs (cutout + crop). Also removes the upload + original once it has no items left. */
export async function deleteItem(id: string) {
  const rows = await sql`delete from items where id = ${id} returning cutout_url, crop_url, upload_id`;
  const row = rows[0] as { cutout_url: string | null; crop_url: string; upload_id: string | null } | undefined;
  if (!row) return false;
  await deleteBlobs([row.cutout_url, row.crop_url]);
  if (row.upload_id) {
    const left = await sql`select 1 from items where upload_id = ${row.upload_id} limit 1`;
    if (!left.length) {
      const up = await sql`delete from uploads where id = ${row.upload_id} returning original_url`;
      await deleteBlobs([up[0]?.original_url as string | undefined]);
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Outfits
// ---------------------------------------------------------------------------
import type { Outfit } from "./types";

export async function getItemsByIds(ids: string[]) {
  if (!ids.length) return [] as Item[];
  return (await sql`select * from items where id = any(${ids}::uuid[])`) as Item[];
}

export async function incrementTimesSuggested(ids: string[]) {
  if (!ids.length) return;
  // Count repeats (an item in 3 outfits gets +3).
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  const uniq = [...counts.keys()];
  const incs = uniq.map((id) => counts.get(id)!);
  await sql`
    update items set times_suggested = times_suggested + t.n
    from unnest(${uniq}::uuid[], ${incs}::int[]) as t(id, n)
    where items.id = t.id`;
}

export async function insertOutfit(o: {
  name: string;
  style_tag: string;
  occasion: string | null;
  reasoning: string;
  missing_piece: string | null;
  color_story: string;
  item_ids: string[];
  source: string;
}) {
  const rows = await sql`
    insert into outfits (name, style_tag, occasion, reasoning, missing_piece, color_story, item_ids, source)
    values (${o.name}, ${o.style_tag}, ${o.occasion}, ${o.reasoning}, ${o.missing_piece}, ${o.color_story}, ${o.item_ids}::uuid[], ${o.source})
    returning *`;
  return rows[0] as Outfit;
}

export async function getOutfit(id: string) {
  const rows = await sql`select * from outfits where id = ${id}`;
  return (rows[0] as Outfit | undefined) ?? null;
}

/** Lookbook: outfits the user saved (daily-drop outfits only appear once saved/favourited). */
export async function listLookbook() {
  return (await sql`select * from outfits where source <> 'daily' or is_favorite order by created_at desc`) as Outfit[];
}

export async function setOutfitBoard(id: string, boardUrl: string) {
  await sql`update outfits set board_url = ${boardUrl} where id = ${id}`;
}

export async function deleteOutfit(id: string) {
  const rows = await sql`delete from outfits where id = ${id} returning board_url`;
  if (!rows.length) return false;
  await deleteBlobs([rows[0].board_url as string | null]);
  return true;
}
