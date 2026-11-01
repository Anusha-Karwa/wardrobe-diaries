import path from "node:path";
import sharp, { type OverlayOptions } from "sharp";
import { BOARD_BG, BOARD_H, BOARD_W, CONTENT_H, layoutBoard } from "./board-layout";
import type { Item } from "./types";
import { labelize } from "./utils";

/**
 * Outfit board renderer (spec 6e): item cutouts arranged on one 1080×1350 canvas like a Pinterest flat-lay,
 * with soft drop shadows and a serif footer. Fonts are bundled (assets/fonts) because Vercel has no system fonts.
 */
const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
const SERIF = path.join(FONT_DIR, "PlayfairDisplay-SemiBold.ttf");
const SANS = path.join(FONT_DIR, "Inter-Medium.ttf");

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function fetchImage(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function text(markup: string, font: string, fontfile: string, width: number) {
  return sharp({ text: { text: markup, font, fontfile, rgba: true, width, dpi: 72, wrap: "word" } }).png().toBuffer({ resolveWithObject: true });
}

/** Resize a piece into its slot (contain), and build a soft shadow from its alpha. */
async function piece(buf: Buffer, w: number, h: number, isCutout: boolean) {
  let img = sharp(buf).resize(w, h, { fit: "inside" });
  if (!isCutout) {
    // Crops: rounded corners so they read as a "photo card" on the board.
    const meta = await sharp(buf).resize(w, h, { fit: "inside" }).toBuffer({ resolveWithObject: true });
    const r = 24;
    const mask = Buffer.from(
      `<svg width="${meta.info.width}" height="${meta.info.height}"><rect width="100%" height="100%" rx="${r}" ry="${r}"/></svg>`
    );
    img = sharp(meta.data).composite([{ input: mask, blend: "dest-in" }]);
  }
  const { data, info } = await img.ensureAlpha().png().toBuffer({ resolveWithObject: true });
  const alpha = await sharp(data).extractChannel("alpha").toBuffer();
  const pad = 30;
  const shadow = await sharp({ create: { width: info.width, height: info.height, channels: 3, background: "#3b2f2a" } })
    .joinChannel(await sharp(alpha).linear(0.22, 0).toBuffer())
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .blur(14)
    .png()
    .toBuffer();
  return { data, width: info.width, height: info.height, shadow, pad };
}

export async function renderBoard(o: { name: string | null; style_tag: string | null; color_story?: string | null; items: Item[] }) {
  const placements = layoutBoard(o.items);
  const layers: OverlayOptions[] = [];

  const pieces = await Promise.all(
    placements.map(async ({ item, slot }) => {
      try {
        const buf = await fetchImage(item.cutout_url ?? item.crop_url);
        return { slot, p: await piece(buf, slot.w, slot.h, !!item.cutout_url) };
      } catch (err) {
        console.warn("[board] skipped item", item.id, (err as Error).message);
        return null;
      }
    })
  );
  for (const r of pieces) {
    if (!r) continue;
    const { slot, p } = r;
    const left = Math.round(slot.x + (slot.w - p.width) / 2);
    const top = Math.round(slot.y + (slot.h - p.height) / 2);
    layers.push({ input: p.shadow, left: left - p.pad + 8, top: top - p.pad + 14 });
    layers.push({ input: p.data, left, top });
  }

  // Footer: thin rule, outfit name (serif), style tag + colour story (sans, rose), wordmark.
  layers.push({
    input: Buffer.from(`<svg width="${BOARD_W}" height="2"><rect width="${BOARD_W - 96}" x="48" height="2" fill="#e7e1da"/></svg>`),
    left: 0,
    top: CONTENT_H + 10,
  });
  const title = await text(`<span foreground="#1a1a1a">${esc(o.name || "Outfit")}</span>`, "Playfair Display SemiBold 50", SERIF, 760);
  layers.push({ input: title.data, left: 48, top: CONTENT_H + 34 });
  const sub = [o.style_tag ? labelize(o.style_tag) : "", o.color_story ?? ""].filter(Boolean).join("  ·  ");
  if (sub) {
    const s = await text(`<span foreground="#b23a48">${esc(sub.slice(0, 90))}</span>`, "Inter Medium 24", SANS, 760);
    layers.push({ input: s.data, left: 50, top: Math.min(BOARD_H - 40, CONTENT_H + 44 + title.info.height) });
  }
  const mark = await text(`<span foreground="#9a918a">closet</span>`, "Playfair Display SemiBold 30", SERIF, 200);
  layers.push({ input: mark.data, left: BOARD_W - 48 - mark.info.width, top: CONTENT_H + 48 });

  return sharp({ create: { width: BOARD_W, height: BOARD_H, channels: 4, background: BOARD_BG } })
    .composite(layers)
    .png({ compressionLevel: 8 })
    .toBuffer();
}
