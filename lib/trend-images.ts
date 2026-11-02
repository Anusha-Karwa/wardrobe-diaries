import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { putBlob } from "./blob";
import { sql } from "./db";
import { gemini } from "./gemini";
import { GEMINI_IMAGE_MODEL } from "./extraction/product-shot";

/**
 * A real photo for each trend: one Google Images search (via SerpApi) for the trend as people wear it,
 * copied into Blob at a small size. Photos are reused when a trend repeats (same title), and an AI-drawn
 * picture fills in if the search fails or the monthly searches run out, so a trend is never picture-less.
 */
const SKIP = /logo|icon|banner|sprite|placeholder/i;

async function download(url: string) {
  const r = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36" } });
  if (!r.ok || !(r.headers.get("content-type") ?? "").startsWith("image/")) throw new Error(`image ${r.status}`);
  const raw = Buffer.from(await r.arrayBuffer());
  const meta = await sharp(raw).metadata();
  if ((meta.width ?? 0) < 160 || (meta.height ?? 0) < 160) throw new Error("too small");
  // Portrait tile, like a pin.
  return sharp(raw).rotate().resize(600, 750, { fit: "cover", position: "attention" }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}

async function searchPhoto(query: string): Promise<{ jpg: Buffer; page: string | null } | null> {
  const key = process.env.SERPAPI_KEY;
  if (!key) return null;
  const params = new URLSearchParams({ engine: "google_images", q: query, gl: "in", hl: "en", api_key: key });
  const res = await fetch(`https://serpapi.com/search.json?${params}`, { signal: AbortSignal.timeout(30_000) });
  const body = (await res.json()) as { images_results?: { original?: string; thumbnail?: string; link?: string; original_width?: number; original_height?: number; title?: string }[]; error?: string };
  if (!res.ok || body.error) throw new Error(body.error ?? `SerpApi ${res.status}`);
  const results = (body.images_results ?? [])
    .filter((r) => (r.original_width ?? 0) >= 400 && !SKIP.test(`${r.original} ${r.title}`))
    // Prefer portrait / square photos (people wearing the trend) over wide banners.
    .sort((a, b) => Number((b.original_height ?? 0) >= (b.original_width ?? 0) * 0.9) - Number((a.original_height ?? 0) >= (a.original_width ?? 0) * 0.9))
    .slice(0, 5);
  for (const r of results) {
    for (const u of [r.original, r.thumbnail].filter((x): x is string => !!x)) {
      try {
        return { jpg: await download(u), page: r.link ?? null };
      } catch {
        /* next */
      }
    }
  }
  return null;
}

async function drawPhoto(title: string, category: string | null) {
  const res = await gemini().models.generateContent({
    model: GEMINI_IMAGE_MODEL,
    contents: `Editorial fashion photo illustrating the trend "${title}" (${category ?? "fashion"}), styled as a full outfit on a model in an Indian city street-style setting, natural daylight, portrait orientation, no text, no logos, fully and modestly clothed.`,
    config: { responseModalities: ["IMAGE"], abortSignal: AbortSignal.timeout(60_000) },
  });
  const data = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data;
  if (!data) return null;
  return sharp(Buffer.from(data, "base64")).resize(600, 750, { fit: "cover", position: "attention" }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Give one trend a photo (reuse → web search → AI drawing). Returns the image URL or null. */
export async function ensureTrendImage(t: { id: string; title: string; category: string | null; search_query: string | null }) {
  // Reuse a photo from an earlier week's trend with the same name.
  const prev = await sql`select image_url, image_page from trends where image_url is not null and id <> ${t.id} and lower(regexp_replace(title, '[^a-zA-Z0-9]+', ' ', 'g')) = ${norm(t.title)} order by created_at desc limit 1`;
  if (prev.length) {
    await sql`update trends set image_url = ${prev[0].image_url}, image_page = ${prev[0].image_page} where id = ${t.id}`;
    return prev[0].image_url as string;
  }
  let jpg: Buffer | null = null;
  let page: string | null = null;
  try {
    const found = await searchPhoto(`${t.search_query || t.title} outfit street style`);
    if (found) [jpg, page] = [found.jpg, found.page];
  } catch (err) {
    console.warn(`[trend-images] search failed for "${t.title}":`, (err as Error).message);
  }
  if (!jpg) {
    try {
      jpg = await drawPhoto(t.title, t.category);
    } catch (err) {
      console.warn(`[trend-images] drawing failed for "${t.title}":`, (err as Error).message);
    }
  }
  if (!jpg) return null;
  const url = await putBlob(`trends/${t.id}-${randomUUID().slice(0, 6)}.jpg`, jpg, "image/jpeg");
  await sql`update trends set image_url = ${url}, image_page = ${page} where id = ${t.id}`;
  return url;
}

/** Photos for many trends, a few at a time. */
export async function ensureTrendImages(trends: { id: string; title: string; category: string | null; search_query: string | null; image_url?: string | null }[], concurrency = 5) {
  const queue = trends.filter((t) => !t.image_url);
  let done = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (queue.length) {
        const t = queue.shift()!;
        if (await ensureTrendImage(t).catch(() => null)) done++;
      }
    })
  );
  return done;
}
