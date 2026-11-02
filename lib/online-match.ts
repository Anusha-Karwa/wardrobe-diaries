import sharp from "sharp";
import { z } from "zod";
import { deleteBlobs, putBlob } from "./blob";
import { sql } from "./db";
import { getItem } from "./queries";
import { aiProductShot } from "./extraction/product-shot";
import type { DetectedItem } from "./extraction/detect";
import type { ItemAttributes } from "./extraction/attributes";
import type { Item, OnlineMatch } from "./types";
import { dedupeMatches } from "./utils";

/**
 * "Similar online": Google Lens visual matches (via SerpApi) for an item's crop.
 * We send the item's public crop URL; Lens returns product photos that look nearly identical,
 * with store, price and link. Results are cached on the item (free plan = 100 searches/month).
 */
const VisualMatch = z
  .object({
    title: z.string().optional(),
    link: z.string().optional(),
    source: z.string().optional(),
    thumbnail: z.string().optional(),
    image: z.string().optional(),
    price: z.object({ value: z.string().optional() }).partial().optional(),
    in_stock: z.boolean().optional(),
  })
  .passthrough();
const LensResponse = z.object({ visual_matches: z.array(VisualMatch).optional(), error: z.string().optional() }).passthrough();

/** Stores that are useful to a shopper in India rank higher. */
const PREFERRED = /myntra|ajio|nykaa|amazon\.in|flipkart|tatacliq|h&m|hm\.com|zara|mango|uniqlo|westside|lifestyle|max ?fashion|snitch|bewakoof|fabindia|libas|biba|w for woman|puma|nike|adidas|bata|metro|mochi|lavie|caprese|accessorize|tanishq|caratlane|giva|meesho|shoppers ?stop|marks|levi/i;
/** Results that are rarely products (social posts, videos, forums). */
const NOT_SHOPS = /pinterest|instagram|facebook|youtube|tiktok|reddit|twitter|x\.com|quora|threads/i;

export const onlineMatchEnabled = () => !!process.env.SERPAPI_KEY;

export async function searchOnlineMatches(item: Item, limit = 4): Promise<OnlineMatch[]> {
  const key = process.env.SERPAPI_KEY;
  if (!key) throw new Error("SERPAPI_KEY is not set");
  const params = new URLSearchParams({
    engine: "google_lens",
    url: item.crop_url,
    country: "in",
    hl: "en",
    api_key: key,
  });
  const res = await fetch(`https://serpapi.com/search.json?${params}`, { signal: AbortSignal.timeout(45_000) });
  const body = LensResponse.parse(await res.json());
  if (!res.ok || body.error) throw new Error(body.error ?? `SerpApi ${res.status}`);

  const seen = new Set<string>();
  const matches = (body.visual_matches ?? [])
    .filter((m) => m.title && m.link && m.thumbnail && !NOT_SHOPS.test(`${m.source} ${m.link}`))
    // Lens often lists the same product twice.
    .filter((m) => {
      const k = m.link!.split("?")[0];
      return seen.has(k) ? false : (seen.add(k), true);
    })
    .map((m, i) => ({
      m,
      // Lens order is visual similarity; nudge real shops (price / Indian stores) up a little.
      score: i - (m.price?.value ? 3 : 0) - (PREFERRED.test(`${m.source} ${m.link}`) ? 4 : 0),
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map(({ m }) => ({
      title: m.title!.slice(0, 140),
      link: m.link!,
      source: m.source ?? new URL(m.link!).hostname.replace(/^www\./, ""),
      thumbnail: m.thumbnail!,
      image: m.image ?? null,
      price: m.price?.value ?? null,
    }));
  return matches;
}

/** Cached search: returns stored results unless refresh is requested. */
export async function getOnlineMatches(itemId: string, refresh = false) {
  const item = await getItem(itemId);
  if (!item) throw new Error("Item not found");
  if (!refresh && Array.isArray(item.online_matches)) return { item, matches: dedupeMatches(item.online_matches), cached: true };
  const matches = await searchOnlineMatches(item);
  await sql`update items set online_matches = ${JSON.stringify(matches)}::jsonb where id = ${itemId}`;
  return { item: { ...item, online_matches: matches }, matches, cached: false };
}

/**
 * Make a chosen match the item's picture. Store photos usually show the item ON A MODEL, so the photo is passed through
 * the same "isolate the garment" step as worn items (from a sharp, real product photo of the actual item, so it stays faithful).
 * If that fails, the plain photo is saved and the browser removes its background (needs_bg_removal).
 */
export async function applyOnlineMatch(itemId: string, index: number): Promise<{ item: Item; needs_bg_removal: boolean }> {
  const item = await getItem(itemId);
  const match = dedupeMatches(item?.online_matches)[index];
  if (!item || !match) throw new Error("Match not found");

  let buf: Buffer | null = null;
  for (const url of [match.image, match.thumbnail].filter((u): u is string => !!u)) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "Mozilla/5.0" } });
      if (!r.ok || !(r.headers.get("content-type") ?? "").startsWith("image/")) continue;
      const raw = Buffer.from(await r.arrayBuffer());
      const meta = await sharp(raw).metadata();
      if ((meta.width ?? 0) < 120) continue; // too small to be useful; try the next source
      buf = await sharp(raw).rotate().resize(1024, 1024, { fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 90 }).toBuffer();
      break;
    } catch {
      /* try the next url */
    }
  }
  if (!buf) throw new Error("Couldn't download that product photo. Try another match.");

  const asDetected = {
    label: item.subcategory ?? item.category,
    box_2d: [0, 0, 1000, 1000],
    bbox: { x: 0, y: 0, w: 1, h: 1 },
    attrs: { ...item, description: `${item.description ?? ""} (as in this store photo: ${match.title})` } as unknown as ItemAttributes,
  } as DetectedItem;
  const isolated = await aiProductShot(buf, asDetected, 40_000);

  const url = isolated
    ? await putBlob(`items/${itemId}-match-${Date.now()}.png`, isolated, "image/png")
    : await putBlob(`items/${itemId}-match-${Date.now()}.jpg`, buf, "image/jpeg");
  const rows = await sql`
    update items set cutout_url = ${url}, cutout_method = 'online_match', matched_product = ${JSON.stringify(match)}::jsonb
    where id = ${itemId} returning *`;
  // Old AI/real cutout files are replaced; the crop is always kept.
  if (item.cutout_url && item.cutout_url !== url) await deleteBlobs([item.cutout_url]);
  return { item: rows[0] as Item, needs_bg_removal: !isolated };
}
