import { listItems } from "@/lib/queries";
import { getCurrentTrends, getPastTrends } from "@/lib/trends";
import { TrendsClient } from "./trends-client";

export const dynamic = "force-dynamic";

export default async function TrendsPage() {
  const [current, past, wardrobe] = await Promise.all([getCurrentTrends(), getPastTrends(), listItems()]);
  return <TrendsClient current={current} past={past} wardrobe={wardrobe} />;
}
