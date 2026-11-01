import { notFound } from "next/navigation";
import { getItem, getUpload } from "@/lib/queries";
import { ItemDetail } from "./item-detail";

export const dynamic = "force-dynamic";

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const item = await getItem(id);
  if (!item) notFound();
  const upload = item.upload_id ? await getUpload(item.upload_id) : null;
  return <ItemDetail initial={item} originalUrl={upload?.original_url ?? null} />;
}
