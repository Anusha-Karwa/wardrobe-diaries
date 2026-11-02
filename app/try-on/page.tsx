import { Suspense } from "react";
import { getProfile, listItems } from "@/lib/queries";
import { getCurrentTrends } from "@/lib/trends";
import { FittingRoom } from "./fitting-room";

export const dynamic = "force-dynamic";

export default async function TryOnPage() {
  const [items, profile, trends] = await Promise.all([listItems(), getProfile(), getCurrentTrends().catch(() => [])]);
  const recommended = trends
    .filter((t) => t.status === "missing")
    .sort((a, b) => b.pairs_with_item_ids.length * (b.heat ?? 3) - a.pairs_with_item_ids.length * (a.heat ?? 3))
    .slice(0, 3)
    .map((t) => ({ id: t.id, title: t.title, price_band: t.price_band, search_query: t.search_query ?? t.title, category: t.category }));
  return (
    <Suspense>
      <FittingRoom wardrobe={items} bodyPhotoUrl={profile.body_photo_url ?? null} aesthetics={profile.aesthetics} recommended={recommended} />
    </Suspense>
  );
}
