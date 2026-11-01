import Image from "next/image";
import { ShoppingBag } from "lucide-react";
import type { Gap } from "@/lib/outfits";
import type { Item } from "@/lib/types";
import { COLOR_SWATCH } from "@/lib/taxonomy";
import { labelize } from "@/lib/utils";

/** A "missing piece" from the outfit generator. Phase 5 turns these into full "To buy" cards with shop links. */
export function GapCard({ gap, wardrobe }: { gap: Gap; wardrobe: Item[] }) {
  const pairs = gap.pairs_with_item_ids.map((id) => wardrobe.find((i) => i.id === id)).filter((i): i is Item => !!i);
  const colour = gap.attributes.primary_color;
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-primary/40 bg-accent/40 p-4">
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border border-black/10"
          style={{ background: colour ? (COLOR_SWATCH[colour as keyof typeof COLOR_SWATCH] ?? "#eee") : "#fff" }}
        >
          <ShoppingBag className="size-4 text-foreground/70 mix-blend-difference" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-primary">Missing piece · {labelize(gap.category)}</p>
          <p className="font-medium leading-snug">{gap.title}</p>
        </div>
      </div>
      <p className="text-sm text-foreground/80">{gap.why}</p>
      {pairs.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Pairs with</span>
          {pairs.slice(0, 5).map((p) => (
            <div key={p.id} className="relative size-9 overflow-hidden rounded-lg bg-tile">
              <Image src={p.cutout_url ?? p.crop_url} alt={p.description ?? ""} fill sizes="36px" className="object-contain p-0.5" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
