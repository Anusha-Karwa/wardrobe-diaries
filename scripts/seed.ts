/**
 * npm run seed — runs every image in /seed-images through the real extraction pipeline
 * (skipping files already processed, by content hash), then runs one full trend refresh.
 * Flat lays keep their crop (browser background removal needs a browser): open the item and tap "Real cutout".
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

async function main() {
  const { runPipeline } = await import("../lib/extraction/pipeline");
  const { findUploadByHash } = await import("../lib/queries");
  const { refreshAll } = await import("../lib/trends");

  const dir = join(process.cwd(), "seed-images");
  const files = readdirSync(dir).filter((f) => /\.(jpe?g|png|webp|heic)$/i.test(f)).sort();
  console.log(`Seeding ${files.length} photos from seed-images/`);
  let added = 0;
  for (const f of files) {
    const buf = readFileSync(join(dir, f));
    const hash = createHash("sha256").update(buf).digest("hex");
    if (await findUploadByHash(hash)) {
      console.log(`  ↷ ${f} (already in your wardrobe)`);
      continue;
    }
    try {
      const r = await runPipeline(buf, { clientCutout: false, budgetMs: 120_000 });
      added += r.items.length;
      console.log(`  ✓ ${f}: ${r.items.length} item(s) [${r.items.map((i) => i.subcategory).join(", ")}] in ${(r.timings.total / 1000).toFixed(1)}s`);
    } catch (err) {
      console.log(`  ✗ ${f}: ${(err as Error).message}`);
    }
  }
  console.log(`Added ${added} items. Refreshing trends (about 2 minutes)…`);
  const t = await refreshAll(undefined, "weekly", 4);
  console.log(`Trends: ${t.matched} found, ${t.owned} already in your closet. Done.`);
}

main().catch((err) => {
  console.error("✗ seed failed:", err.message ?? err);
  process.exit(1);
});
