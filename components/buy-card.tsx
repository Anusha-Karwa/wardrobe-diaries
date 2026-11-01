"use client";
import { useState } from "react";
import Image from "next/image";
import { Footprints, Gem, Glasses, Heart, Loader2, Shirt, ShoppingBag, Sparkles, Flame, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { COLOR_SWATCH } from "@/lib/taxonomy";
import type { BuyCard as BuyCardT, Item } from "@/lib/types";
import { cn, labelize } from "@/lib/utils";

const CATEGORY_ICON: Record<string, typeof Shirt> = {
  footwear: Footprints,
  jewellery: Gem,
  accessory: Glasses,
  bag: ShoppingBag,
};

export const SHOPS = [
  { key: "myntra", label: "Myntra" },
  { key: "ajio", label: "Ajio" },
  { key: "nykaa", label: "Nykaa Fashion" },
  { key: "amazon", label: "Amazon" },
] as const;

export function ShopButtons({ links, className }: { links: BuyCardT["links"]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-1.5 sm:grid-cols-4", className)}>
      {SHOPS.map((s) => (
        <a
          key={s.key}
          href={links[s.key]}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border bg-white px-2 text-xs font-medium hover:bg-accent"
        >
          {s.label} <ExternalLink className="size-3 opacity-50" />
        </a>
      ))}
    </div>
  );
}

export function PairsWith({ ids, wardrobe }: { ids: string[]; wardrobe: Pick<Item, "id" | "cutout_url" | "crop_url" | "description">[] }) {
  const pairs = ids.map((id) => wardrobe.find((i) => i.id === id)).filter((i) => !!i);
  if (!pairs.length) return null;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Pairs with</span>
      {pairs.slice(0, 5).map((p) => (
        <div key={p!.id} className="relative size-9 overflow-hidden rounded-lg bg-tile" title={p!.description ?? ""}>
          <Image src={p!.cutout_url ?? p!.crop_url} alt={p!.description ?? ""} fill sizes="36px" className="object-contain p-0.5" />
        </div>
      ))}
      {pairs.length > 5 && <span className="text-xs text-muted-foreground">+{pairs.length - 5}</span>}
    </div>
  );
}

export function TrendBadge({ heat, title }: { heat: number; title?: string }) {
  return (
    <span title={title ? `Trending: ${title}` : "Trending now"} className="inline-flex items-center gap-0.5 rounded-full bg-trend px-2 py-0.5 text-[11px] font-semibold text-trend-foreground">
      <Flame className="size-3" /> Trending{" "}
      {Array.from({ length: Math.max(1, Math.min(5, heat)) }).map((_, i) => (
        <span key={i}>🔥</span>
      ))}
    </span>
  );
}

/** "To buy" card (spec 6h/6j): what to buy, why, what it pairs with, trend badge, shop search links, wishlist. */
export function BuyCard({ card, wardrobe, saved: savedInitially = false }: { card: BuyCardT; wardrobe: Item[]; saved?: boolean }) {
  const [saved, setSaved] = useState(savedInitially);
  const [busy, setBusy] = useState(false);
  const colour = card.attributes.primary_color as keyof typeof COLOR_SWATCH | undefined;
  const Icon = CATEGORY_ICON[card.category] ?? (card.category === "topwear" || card.category === "dress" ? Shirt : Sparkles);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/wishlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(card) });
      if (!res.ok) throw new Error("Couldn't save");
      const { duplicate } = await res.json();
      setSaved(true);
      toast.success(duplicate ? "Already in your wishlist" : "Added to your wishlist");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-black/10"
          style={{ background: colour ? COLOR_SWATCH[colour] ?? "#f1ece6" : "#f1ece6" }}
          title={colour ? labelize(colour) : undefined}
        >
          <span className="flex size-7 items-center justify-center rounded-lg bg-white/85">
            <Icon className="size-4 text-foreground/80" />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">To buy · {labelize(card.category)}</span>
            {card.trend && <TrendBadge heat={card.trend.heat} title={card.trend.title} />}
          </div>
          <p className="mt-0.5 font-medium leading-snug">{card.title}</p>
          <p className="text-xs text-muted-foreground">{card.price_band}</p>
        </div>
      </div>

      {card.why && <p className="text-sm leading-snug text-foreground/80">{card.why}</p>}
      {card.trend && <p className="text-xs text-trend-foreground">🔥 Part of the “{card.trend.title}” trend right now.</p>}
      <PairsWith ids={card.pairs_with_item_ids} wardrobe={wardrobe} />

      <ShopButtons links={card.links} />

      {card.trend?.sources?.length ? (
        <p className="text-[11px] text-muted-foreground">
          Sources:{" "}
          {card.trend.sources.map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
              {s.title}
              {i < card.trend!.sources.length - 1 ? ", " : ""}
            </a>
          ))}
        </p>
      ) : null}

      <Button size="sm" variant={saved ? "secondary" : "outline"} onClick={save} disabled={busy || saved}>
        {busy ? <Loader2 className="animate-spin" /> : <Heart className={cn(saved && "fill-primary text-primary")} />}
        {saved ? "In your wishlist" : "Add to wishlist"}
      </Button>
    </div>
  );
}
