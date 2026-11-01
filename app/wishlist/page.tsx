import { listItems, listWishlist } from "@/lib/queries";
import { WishlistClient } from "./wishlist-client";

export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const [wishlist, wardrobe] = await Promise.all([listWishlist(), listItems()]);
  return <WishlistClient initial={wishlist} wardrobe={wardrobe} />;
}
