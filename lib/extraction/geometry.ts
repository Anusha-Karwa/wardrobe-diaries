import type { BBox } from "@/lib/types";

/** Gemini box_2d [ymin, xmin, ymax, xmax] in 0..1000 → normalised {x,y,w,h} in 0..1. */
export function box2dToBBox(b: number[]): BBox {
  const [ymin, xmin, ymax, xmax] = b.map((v) => Math.min(1000, Math.max(0, v)) / 1000);
  return { x: Math.min(xmin, xmax), y: Math.min(ymin, ymax), w: Math.abs(xmax - xmin), h: Math.abs(ymax - ymin) };
}

export const area = (b: BBox) => b.w * b.h;

export function iou(a: BBox, b: BBox) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = area(a) + area(b) - inter;
  return union > 0 ? inter / union : 0;
}

/** Normalised box → integer pixel rect, optionally padded by a fraction of its size, clamped to the image. */
export function toPixels(b: BBox, width: number, height: number, pad = 0) {
  const px = b.w * pad;
  const py = b.h * pad;
  const left = Math.max(0, Math.floor((b.x - px) * width));
  const top = Math.max(0, Math.floor((b.y - py) * height));
  const right = Math.min(width, Math.ceil((b.x + b.w + px) * width));
  const bottom = Math.min(height, Math.ceil((b.y + b.h + py) * height));
  return { left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}
