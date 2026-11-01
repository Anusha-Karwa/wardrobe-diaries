import sharp from "sharp";
import type { BBox } from "@/lib/types";
import { toPixels } from "./geometry";

/** Padded rectangle crop (box + 6% padding, clamped) as JPEG — always saved as the fallback image. */
export async function paddedCrop(image: Buffer, bbox: BBox, width: number, height: number, pad = 0.06) {
  const rect = toPixels(bbox, width, height, pad);
  return sharp(image).extract(rect).jpeg({ quality: 88 }).toBuffer();
}

/** Opaque bounding box of an alpha channel (values > threshold). */
function alphaBounds(alpha: Buffer, w: number, h: number, threshold = 8) {
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha[y * w + x] > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? null : { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * Finish any RGBA cutout so they all look consistent:
 * trim transparent edges, then centre on a square transparent canvas with ~8% margin.
 * Returns null if the image is (almost) fully transparent.
 */
export async function finishCutout(rgba: Buffer, maxSide = 1024): Promise<Buffer | null> {
  const { data, info } = await sharp(rgba).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels } = info;
  const alpha = Buffer.alloc(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = data[i * channels + 3];
  const bounds = alphaBounds(alpha, w, h);
  if (!bounds) return null;

  const trimmed = sharp(data, { raw: { width: w, height: h, channels } }).extract(bounds);
  const side = Math.round(Math.max(bounds.width, bounds.height) / 0.84); // 8% margin each side
  const scale = Math.min(1, maxSide / side);
  const inner = await trimmed
    .resize(Math.max(1, Math.round(bounds.width * scale)), Math.max(1, Math.round(bounds.height * scale)))
    .png()
    .toBuffer({ resolveWithObject: true });
  const canvas = Math.round(side * scale);
  return sharp({ create: { width: canvas, height: canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      {
        input: inner.data,
        left: Math.round((canvas - inner.info.width) / 2),
        top: Math.round((canvas - inner.info.height) / 2),
      },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * Stage 4: apply a Gemini probability mask (PNG the size of the box) to the box region.
 * Returns the finished cutout, or null if the mask fails the quality check.
 */
export async function applyMask(image: Buffer, bbox: BBox, width: number, height: number, maskPng: Buffer) {
  const rect = toPixels(bbox, width, height);
  const crop = await sharp(image).extract(rect).removeAlpha().raw().toBuffer();

  // Resize mask to the box, single channel, soft edges, then kill haze (<100 → 0).
  const mask = await sharp(maskPng, { failOn: "none" })
    .resize(rect.width, rect.height, { fit: "fill" })
    .greyscale()
    .blur(0.6)
    .extractChannel(0)
    .raw()
    .toBuffer();
  let opaque = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] < 100) mask[i] = 0;
    else opaque++;
  }

  // Quality check: a real garment covers 15–97% of its own box.
  const coverage = opaque / mask.length;
  if (coverage < 0.15 || coverage > 0.97) return { cutout: null, coverage };

  const rgba = await sharp(crop, { raw: { width: rect.width, height: rect.height, channels: 3 } })
    .joinChannel(mask, { raw: { width: rect.width, height: rect.height, channels: 1 } })
    .png()
    .toBuffer();
  return { cutout: await finishCutout(rgba), coverage };
}

export type KeyColour = "green" | "magenta";

/**
 * Remove a flat chroma-key background (pure green or magenta) → RGBA.
 * Soft alpha on the edge band, plus colour "despill" so edges don't glow green/pink.
 */
export async function chromaKey(image: Buffer, key: KeyColour) {
  const { data, info } = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const out = Buffer.alloc(w * h * 4);
  let transparent = 0;
  for (let i = 0; i < w * h; i++) {
    let r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    // "Keyness": how much the key channel(s) dominate the others.
    const k = key === "green" ? g - Math.max(r, b) : Math.min(r, b) - g;
    let a = 255;
    if (k > 90) a = 0;
    else if (k > 35) a = Math.round(255 * (1 - (k - 35) / 55));
    if (a < 255) {
      // despill
      if (key === "green") g = Math.min(g, Math.max(r, b));
      else {
        const cap = g + 10;
        r = Math.min(r, cap);
        b = Math.min(b, cap);
      }
    }
    if (a === 0) transparent++;
    out[i * 4] = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = a;
  }
  const png = await sharp(out, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
  return { png, transparentFraction: transparent / (w * h) };
}
