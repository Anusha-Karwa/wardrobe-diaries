"use client";
/**
 * Stage 5 (browser): run @imgly/background-removal on the item's crop and upload the PNG.
 * Loaded on demand: the model (~40 MB) downloads from IMG.LY's CDN on first use, then is cached by the browser.
 */
import type { Item } from "@/lib/types";

/**
 * Remove the background from the item's crop (default) or from another image of it, e.g. a picked online match.
 * `keepMethod` saves the result without changing the cutout method badge.
 */
export async function browserCutout(
  item: Item,
  onProgress?: (label: string) => void,
  opts: { source?: string; keepMethod?: "online_match" } = {}
): Promise<Item> {
  const { removeBackground } = await import("@imgly/background-removal");
  onProgress?.("Loading the cutout model…");
  const blob = await removeBackground(opts.source ?? item.crop_url, {
    model: "isnet_fp16",
    output: { format: "image/png", quality: 1 },
    progress: (key, current, total) => {
      if (key.startsWith("fetch") && total) onProgress?.(`Loading the cutout model… ${Math.round((current / total) * 100)}%`);
      else if (key.startsWith("compute")) onProgress?.("Cleaning up background…");
    },
  });
  onProgress?.("Saving cutout…");
  const form = new FormData();
  form.append("file", new File([blob], "cutout.png", { type: "image/png" }));
  if (opts.keepMethod) form.append("method", opts.keepMethod);
  const res = await fetch(`/api/items/${item.id}/cutout`, { method: "POST", body: form });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Upload failed");
  return res.json();
}

export async function switchToCrop(itemId: string): Promise<Item> {
  const res = await fetch(`/api/items/${itemId}/cutout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method: "crop_only" }),
  });
  if (!res.ok) throw new Error("Couldn't switch to the crop");
  return res.json();
}
