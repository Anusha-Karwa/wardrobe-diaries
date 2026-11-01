import type { Item } from "./types";

/**
 * Outfit board template (spec 6e), shared by the sharp renderer and the instant CSS board,
 * so the downloaded PNG and the on-screen board always match.
 * Canvas 1080×1350 (4:5). Slots are pixel rects on that canvas; the footer sits below CONTENT_H.
 */
export const BOARD_W = 1080;
export const BOARD_H = 1350;
export const CONTENT_H = 1200;
export const BOARD_BG = "#FAF8F5";

export interface Slot {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Placement {
  item: Item;
  slot: Slot;
}

type Kind = "top" | "bottom" | "full" | "outer" | "shoes" | "bag" | "small";

function kindOf(it: Pick<Item, "category" | "subcategory">): Kind {
  switch (it.category) {
    case "topwear":
      return "top";
    case "bottomwear":
      return "bottom";
    case "dress":
    case "ethnic_set":
      return "full";
    case "outerwear":
      return it.subcategory === "dupatta" ? "small" : "outer";
    case "footwear":
      return "shoes";
    case "bag":
      return "bag";
    case "innerwear_activewear":
      return /bottom/.test(it.subcategory ?? "") ? "bottom" : "top";
    default:
      return "small"; // jewellery, accessory
  }
}

/** Two layouts: separates (top + bottom) and full-length (dress / ethnic set). */
const SEPARATES: Record<Exclude<Kind, "full" | "small">, Slot> = {
  top: { x: 40, y: 40, w: 560, h: 520 }, // upper-left, large
  outer: { x: 620, y: 40, w: 420, h: 470 }, // upper-right
  bottom: { x: 250, y: 520, w: 520, h: 660 }, // lower-centre, large
  shoes: { x: 30, y: 900, w: 300, h: 280 }, // bottom-left
  bag: { x: 770, y: 880, w: 280, h: 300 }, // bottom-right
};
const FULL: Record<Exclude<Kind, "top" | "bottom" | "small">, Slot> = {
  full: { x: 190, y: 40, w: 560, h: 1140 }, // centre, extra large
  outer: { x: 730, y: 40, w: 330, h: 420 },
  shoes: { x: 20, y: 930, w: 260, h: 250 },
  bag: { x: 790, y: 900, w: 270, h: 280 },
};
/** Small slots for jewellery/accessories down the right column (and left column for full looks). */
const SMALL_SEPARATES: Slot[] = [
  { x: 840, y: 530, w: 200, h: 170 },
  { x: 840, y: 710, w: 200, h: 160 },
  { x: 60, y: 600, w: 190, h: 160 },
  { x: 60, y: 760, w: 170, h: 140 },
];
const SMALL_FULL: Slot[] = [
  { x: 790, y: 480, w: 230, h: 190 },
  { x: 790, y: 690, w: 230, h: 190 },
  { x: 30, y: 80, w: 170, h: 170 },
  { x: 30, y: 300, w: 170, h: 170 },
];

export function layoutBoard(items: Item[]): Placement[] {
  const isFull = items.some((i) => kindOf(i) === "full");
  const big = isFull ? FULL : SEPARATES;
  const smalls = [...(isFull ? SMALL_FULL : SMALL_SEPARATES)];
  const used = new Set<string>();
  const out: Placement[] = [];
  const overflow: Item[] = [];

  for (const item of items) {
    let k = kindOf(item);
    // A second top becomes the layer in the outerwear slot; extras fall back to small slots.
    if (k === "top" && used.has("top") && !used.has("outer")) k = "outer";
    if (k === "full" && !isFull) k = "small";
    const slot = k !== "small" ? (big as Record<string, Slot>)[k] : undefined;
    if (slot && !used.has(k)) {
      used.add(k);
      out.push({ item, slot });
    } else overflow.push(item);
  }
  // Empty big slots on the right can host small things too.
  if (!used.has("outer")) smalls.unshift(isFull ? FULL.outer : { x: 660, y: 60, w: 340, h: 340 });
  for (const item of overflow) {
    const slot = smalls.shift();
    if (slot) out.push({ item, slot });
  }
  // Draw big pieces first so small ones sit on top.
  const order: Record<Kind, number> = { full: 0, bottom: 1, top: 2, outer: 3, shoes: 4, bag: 5, small: 6 };
  return out.sort((a, b) => order[kindOf(a.item)] - order[kindOf(b.item)]);
}
