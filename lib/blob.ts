import { put, del } from "@vercel/blob";

/** Upload a buffer to Vercel Blob (public). Paths: originals/…, items/…, boards/… */
export async function putBlob(path: string, body: Buffer, contentType: string) {
  const res = await put(path, body, {
    access: "public",
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60 * 60 * 24 * 30,
  });
  return res.url;
}

/** Delete one or more blobs; never throws (a missing blob shouldn't break a delete). */
export async function deleteBlobs(urls: (string | null | undefined)[]) {
  const list = urls.filter((u): u is string => !!u);
  if (!list.length) return;
  try {
    await del(list);
  } catch (err) {
    console.warn("[blob] delete failed", err);
  }
}
