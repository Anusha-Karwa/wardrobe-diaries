import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { putBlob } from "@/lib/blob";
import { profileBlock } from "@/lib/prompts";
import { getProfile, insertItem, insertUpload } from "@/lib/queries";
import type { CutoutMethod, Upload, UploadedItem } from "@/lib/types";
import { area } from "./geometry";
import { detectItems, type DetectedItem } from "./detect";
import { SEGMENTATION_ENABLED, segmentItems } from "./segment";
import { applyMask, paddedCrop } from "./cutout";
import { aiProductShot } from "./product-shot";

export interface PipelineResult {
  upload: Upload;
  photoType: string;
  items: UploadedItem[];
  timings: Record<string, number>;
}

/** Photos where items are worn → AI product shots; laid-out items → real-pixel browser cutouts. */
const WORN_TYPES = new Set(["worn", "mixed"]);
/** Small things the product-shot model can't see well in a full-body photo: keep the real crop. */
const TOO_SMALL_FOR_PRODUCT_SHOT = 0.004;

/**
 * The extraction pipeline (spec 6a). One photo in → saved items out.
 * Every stage is timed; any cutout failure falls back (browser removal → crop) and never blocks saving.
 */
export async function runPipeline(
  file: Buffer,
  opts: { budgetMs?: number; /** false when there's no browser (seed script): keep the crop instead. */ clientCutout?: boolean } = {}
): Promise<PipelineResult> {
  const started = Date.now();
  const deadline = started + (opts.budgetMs ?? 52_000);
  const timings: Record<string, number> = {};
  const lap = (name: string, t0: number) => (timings[name] = Date.now() - t0);

  // Stage 1: normalise (EXIF rotate → JPEG ≤1600px) and save the original.
  let t = Date.now();
  const contentHash = createHash("sha256").update(file).digest("hex");
  const { data: jpeg, info } = await sharp(file)
    .rotate()
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 88 })
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const uploadId = randomUUID();
  const [originalUrl, profile] = await Promise.all([
    putBlob(`originals/${uploadId}.jpg`, jpeg, "image/jpeg"),
    getProfile(),
  ]);
  const upload = await insertUpload({ id: uploadId, original_url: originalUrl, width, height, content_hash: contentHash });
  lap("1_normalise", t);

  // Stage 2: detect + describe.
  t = Date.now();
  const detection = await detectItems(jpeg, profileBlock(profile));
  lap("2_detect", t);
  const items = detection.items;
  if (!items.length) return { upload, photoType: detection.photoType, items: [], timings: finish() };

  // A single product covering most of the photo → browser removal is fastest and cleanest.
  const singleLarge = items.length === 1 && area(items[0].bbox) > 0.7;

  // Stage 3: segmentation masks (only if enabled; see segment.ts).
  const masks = new Map<number, Buffer>();
  if (SEGMENTATION_ENABLED && !singleLarge) {
    t = Date.now();
    const got = await segmentItems(jpeg, items, Math.max(5_000, deadline - Date.now() - 15_000));
    got.forEach((v, k) => masks.set(k, v));
    lap("3_segment", t);
  }

  // Stage 4: crops + cutouts, all items in parallel.
  t = Date.now();
  const worn = WORN_TYPES.has(detection.photoType);
  const results = await Promise.all(
    items.map(async (item, idx) => {
      const id = randomUUID();
      const crop = await paddedCrop(jpeg, item.bbox, width, height);
      let cutout: Buffer | null = null;
      let method: CutoutMethod | null = null;

      const mask = masks.get(idx);
      if (mask) {
        const r = await applyMask(jpeg, item.bbox, width, height, mask).catch(() => null);
        if (r?.cutout) [cutout, method] = [r.cutout, "gemini_mask"];
      }
      if (!cutout && worn && !singleLarge && area(item.bbox) >= TOO_SMALL_FOR_PRODUCT_SHOT) {
        const left = deadline - Date.now() - 4_000;
        if (left > 8_000) {
          cutout = await aiProductShot(crop, item, Math.min(30_000, left));
          if (cutout) method = "ai_product_shot";
        }
      }
      // Tiny worn items (e.g. a necklace in a full-body selfie): a cutout would be mush, keep the crop.
      if (!cutout && worn && area(item.bbox) < TOO_SMALL_FOR_PRODUCT_SHOT) method = "crop_only";
      if (!cutout && opts.clientCutout === false) method = "crop_only";

      const [cropUrl, cutoutUrl] = await Promise.all([
        putBlob(`items/${id}-crop.jpg`, crop, "image/jpeg"),
        cutout ? putBlob(`items/${id}.png`, cutout, "image/png") : Promise.resolve(null),
      ]);
      return { id, item, cropUrl, cutoutUrl, method };
    })
  );
  lap("4_cutout", t);

  // Stage 6: save.
  t = Date.now();
  const saved: UploadedItem[] = [];
  for (const r of results) {
    const row = await insertItem({
      id: r.id,
      upload_id: uploadId,
      cutout_url: r.cutoutUrl,
      crop_url: r.cropUrl,
      cutout_method: r.method,
      bbox: r.item.bbox,
      attrs: r.item.attrs,
    });
    // Stage 5 happens in the browser for anything without a cutout yet.
    saved.push({ ...row, needs_client_cutout: !r.cutoutUrl && r.method !== "crop_only" });
  }
  lap("6_save", t);

  return { upload, photoType: detection.photoType, items: saved, timings: finish() };

  function finish() {
    timings.total = Date.now() - started;
    console.log(`[pipeline] ${upload.id} ${detection?.photoType ?? ""} ${JSON.stringify(timings)}`);
    return timings;
  }
}

export type { DetectedItem };
