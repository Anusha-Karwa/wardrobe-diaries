import { getItemsByIds, listLookbook } from "@/lib/queries";
import { LookbookClient } from "./lookbook-client";

export const dynamic = "force-dynamic";

export default async function LookbookPage() {
  const outfits = await listLookbook();
  const items = await getItemsByIds(Array.from(new Set(outfits.flatMap((o) => o.item_ids))));
  const byId = new Map(items.map((i) => [i.id, i]));
  const withItems = outfits.map((o) => ({ ...o, items: o.item_ids.map((id) => byId.get(id)).filter((i) => !!i) }));
  return <LookbookClient initial={withItems} />;
}
