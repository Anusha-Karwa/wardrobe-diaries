import { Suspense } from "react";
import { listItems } from "@/lib/queries";
import { StylistClient } from "./stylist-client";

export const dynamic = "force-dynamic";

export default async function StylistPage() {
  const wardrobe = await listItems();
  return (
    <Suspense>
      <StylistClient wardrobe={wardrobe} />
    </Suspense>
  );
}
