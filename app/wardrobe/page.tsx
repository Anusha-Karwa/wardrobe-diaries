import { Suspense } from "react";
import { listItems } from "@/lib/queries";
import { WardrobeClient } from "./wardrobe-client";

export const dynamic = "force-dynamic";

export default async function WardrobePage() {
  const items = await listItems();
  return (
    <Suspense>
      <WardrobeClient items={items} />
    </Suspense>
  );
}
