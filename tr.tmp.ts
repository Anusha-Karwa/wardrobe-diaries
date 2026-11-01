import { config } from "dotenv"; config({ path: ".env.local" });
(async () => {
  const { refreshGroup, matchCurrentTrends, getCurrentTrends } = await import("./lib/trends");
  const t = Date.now();
  console.log(await refreshGroup("jewellery"), "took", Date.now() - t, "ms");
  console.log(await matchCurrentTrends());
  for (const tr of (await getCurrentTrends()))
    console.log(` 🔥${tr.heat} ${tr.title} ${JSON.stringify(tr.match_attributes)} → ${tr.status} owned=${tr.owned_item_ids.length} pairs=${tr.pairs_with_item_ids.length}\n     sources: ${tr.sources?.map(s => s.title).join(", ")}\n     note: ${tr.note}`);
})().catch(e => console.log("ERR", e));
