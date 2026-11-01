import Image from "next/image";
import type { Item } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Cutout on a checkerboard/grey tile, or the rectangle crop when there's no cutout. */
export function ItemImage({
  item,
  className,
  tile = "grey",
  sizes = "(max-width: 768px) 50vw, 25vw",
  priority,
}: {
  item: Pick<Item, "cutout_url" | "crop_url" | "description" | "subcategory">;
  className?: string;
  tile?: "grey" | "checker";
  sizes?: string;
  priority?: boolean;
}) {
  const src = item.cutout_url ?? item.crop_url;
  const isCutout = !!item.cutout_url;
  return (
    <div
      className={cn(
        "relative aspect-square overflow-hidden rounded-xl",
        tile === "checker" ? "checkerboard" : "bg-tile",
        className
      )}
    >
      <Image
        src={src}
        alt={item.description ?? item.subcategory ?? "Wardrobe item"}
        fill
        sizes={sizes}
        priority={priority}
        className={cn(isCutout ? "object-contain p-3" : "object-cover")}
      />
    </div>
  );
}
