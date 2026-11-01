import { generate, parseJsonText } from "@/lib/gemini";
import { SEGMENTATION_PROMPT, fill } from "@/lib/prompts";
import { box2dToBBox, iou } from "./geometry";
import type { DetectedItem } from "./detect";

/**
 * Stage 3: Gemini segmentation masks (spec 6a).
 * Off by default: on current Gemini 3 Flash models masks take ~50s per item and come back
 * empty/corrupt (tested Nov 2026), and gemini-2.5-flash is no longer offered to new keys.
 * Set GEMINI_SEGMENTATION=on to try it (e.g. if a future model supports it again).
 */
export const SEGMENTATION_ENABLED = process.env.GEMINI_SEGMENTATION === "on";

export async function segmentItems(jpeg: Buffer, items: DetectedItem[], timeoutMs: number): Promise<Map<number, Buffer>> {
  const result = new Map<number, Buffer>();
  if (!items.length) return result;
  const list = items.map((it, i) => `${i + 1}. "${it.label}" box_2d ${JSON.stringify(it.box_2d)}`).join("; ");
  try {
    const res = await generate(
      {
        model: process.env.GEMINI_SEGMENT_MODEL || undefined,
        contents: [
          { inlineData: { mimeType: "image/jpeg", data: jpeg.toString("base64") } },
          fill(SEGMENTATION_PROMPT, { ITEM_LIST: list }),
        ],
        config: { maxOutputTokens: 16000, temperature: 0.2 },
      },
      { label: "segment", timeoutMs, thinkingOff: true }
    );
    const parsed = parseJsonText(res.text);
    const masks = (Array.isArray(parsed) ? parsed : []) as { box_2d?: number[]; mask?: string }[];

    // Match each mask to a detected item by box IoU (highest wins, each item once).
    const pairs: { m: number; i: number; score: number }[] = [];
    masks.forEach((m, mi) => {
      if (!Array.isArray(m.box_2d) || m.box_2d.length !== 4 || typeof m.mask !== "string") return;
      const mb = box2dToBBox(m.box_2d);
      items.forEach((it, ii) => pairs.push({ m: mi, i: ii, score: iou(mb, it.bbox) }));
    });
    pairs.sort((a, b) => b.score - a.score);
    const usedM = new Set<number>();
    for (const p of pairs) {
      if (p.score < 0.3 || usedM.has(p.m) || result.has(p.i)) continue;
      const b64 = masks[p.m].mask!.replace(/^data:image\/\w+;base64,/, "");
      if (b64.length < 100) continue;
      result.set(p.i, Buffer.from(b64, "base64"));
      usedM.add(p.m);
    }
  } catch (err) {
    console.warn("[segment] failed:", (err as Error).message);
  }
  return result;
}
