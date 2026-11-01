import { Suspense } from "react";
import { listItems } from "@/lib/queries";
import { StyleClient } from "./style-client";

export const dynamic = "force-dynamic";

export default async function StylePage() {
  const items = await listItems();
  return (
    <Suspense>
      <StyleClient wardrobe={items} />
    </Suspense>
  );
}
