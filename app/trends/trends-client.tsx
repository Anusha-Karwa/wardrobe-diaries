"use client";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Heart, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ShopButtons } from "@/components/buy-card";
import { shopLinks } from "@/lib/shopping";
import { CATEGORY_GROUPS, type GroupKey } from "@/lib/trend-groups";
import type { BuyCard, Item } from "@/lib/types";
import type { TrendWithMatch } from "@/lib/trends";
import { cn, labelize } from "@/lib/utils";

function toBuyCard(t: TrendWithMatch): BuyCard {
  const attrs = Object.fromEntries(Object.entries(t.match_attributes ?? {}).map(([k, v]) => [k, v[0]]));
  const q = t.search_query || t.title;
  return {
    title: t.title,
    category: t.category ?? "accessory",
    attributes: attrs,
    why: t.note ?? t.summary ?? "",
    pairs_with_item_ids: t.pairs_with_item_ids,
    search_query: q,
    links: shopLinks(q),
    price_band: t.price_band ?? "",
    trend: { id: t.id, title: t.title, heat: t.heat ?? 3, sources: (t.sources ?? []).slice(0, 3) },
  };
}

function Tile({ t, onOpen, i }: { t: TrendWithMatch; onOpen: () => void; i: number }) {
  const reduce = useReducedMotion();
  const owned = t.status === "owned";
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      className="group w-full snap-start text-left"
      // Animates in on load (never left invisible waiting to be scrolled to).
      initial={reduce ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: Math.min(i, 5) * 0.06, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-dashed border-lace bg-tile">
        {t.image_url ? (
          <Image src={t.image_url} alt={t.title} fill unoptimized className="object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <span className="flex size-full items-center justify-center text-4xl">🎀</span>
        )}
        {owned && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold text-emerald-700 shadow-sm">
            <Check className="size-3" /> You own this
          </span>
        )}
      </div>
      <p className="mt-2 line-clamp-2 font-serif text-[15px] font-semibold italic leading-tight">{t.title}</p>
      {t.why_now && <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">{t.why_now}</p>}
    </motion.button>
  );
}

function Detail({ t, wardrobe }: { t: TrendWithMatch; wardrobe: Item[] }) {
  const [saved, setSaved] = useState(false);
  const owned = t.status === "owned";
  const ids = owned ? t.owned_item_ids : t.pairs_with_item_ids;
  const pieces = ids.map((id) => wardrobe.find((i) => i.id === id)).filter((i): i is Item => !!i).slice(0, 5);

  async function save() {
    const res = await fetch("/api/wishlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toBuyCard(t)) });
    if (!res.ok) return toast.error("Couldn't save");
    setSaved(true);
    toast.success((await res.json()).duplicate ? "Already in your wishlist" : "Added to your wishlist");
  }

  return (
    <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-6">
      {t.image_url && (
        <div className="relative mx-auto aspect-[4/5] w-full max-w-xs overflow-hidden rounded-3xl">
          <Image src={t.image_url} alt={t.title} fill unoptimized className="object-cover" />
        </div>
      )}
      {t.why_now && <p className="text-sm">{t.why_now}</p>}
      {t.how_to_style && (
        <p className="text-sm text-muted-foreground">
          <span className="font-bold text-foreground">Wear it: </span>
          {t.how_to_style}
        </p>
      )}
      {pieces.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{owned ? "Already in your closet" : "Goes with your"}</p>
          <div className="flex gap-2">
            {pieces.map((p) => (
              <div key={p.id} className="relative size-14 overflow-hidden rounded-2xl bg-tile">
                <Image src={p.cutout_url ?? p.crop_url} alt={p.description ?? ""} fill sizes="56px" className="object-contain p-1" />
              </div>
            ))}
          </div>
        </div>
      )}
      {!owned && (
        <div className="space-y-2">
          {t.price_band && <p className="text-xs text-muted-foreground">Usually {t.price_band}</p>}
          <ShopButtons links={shopLinks(t.search_query || t.title)} />
          <Button size="sm" variant={saved ? "secondary" : "outline"} onClick={save} disabled={saved} className="w-full">
            <Heart className={cn(saved && "fill-primary text-primary")} /> {saved ? "In your wishlist" : "Add to wishlist"}
          </Button>
        </div>
      )}
      {(t.sources?.length || t.image_page) && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Seen on:{" "}
          {[...(t.sources ?? []).slice(0, 3), ...(t.image_page ? [{ title: "photo source", url: t.image_page }] : [])].map((s, i, arr) => (
            <span key={s.url + i}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-foreground">
                {s.title}
              </a>
              {i < arr.length - 1 ? " · " : ""}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

export function TrendsClient({ current, wardrobe }: { current: TrendWithMatch[]; past?: TrendWithMatch[]; wardrobe: Item[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<TrendWithMatch | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  const updated = current.length ? new Date(Math.max(...current.map((t) => +new Date(t.created_at)))) : null;
  const stale = !updated || Date.now() - +updated > 6 * 24 * 3600 * 1000;
  const groups = CATEGORY_GROUPS.map((g) => ({ ...g, trends: current.filter((t) => t.group_key === g.key).slice(0, 5) })).filter((g) => g.trends.length);

  // Trends refresh automatically every Monday; this is only offered when they're over 6 days old.
  async function refreshNow() {
    const batchId = crypto.randomUUID();
    const queue: GroupKey[] = CATEGORY_GROUPS.map((g) => g.key);
    let failed = 0;
    await Promise.all(
      Array.from({ length: 3 }, async () => {
        while (queue.length) {
          const g = queue.shift()!;
          setRefreshing(CATEGORY_GROUPS.find((x) => x.key === g)!.label);
          const res = await fetch("/api/trends/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ group: g, batchId, period: "weekly" }) }).catch(() => null);
          if (!res?.ok) failed++;
        }
      })
    );
    setRefreshing("your closet");
    await fetch("/api/trends/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ step: "match" }) }).catch(() => null);
    setRefreshing(null);
    router.refresh();
    if (failed) toast.error(`${failed} categor${failed > 1 ? "ies" : "y"} didn't update`);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">This week</p>
          <h1 className="font-serif text-4xl font-semibold italic leading-none">What&apos;s in</h1>
          {updated && (
            <p className="mt-1 text-sm text-muted-foreground">
              Updated {updated.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", timeZone: "Asia/Kolkata" })} · from celebrities, creators &amp; Pinterest
            </p>
          )}
        </div>
        {(stale || refreshing) && (
          <Button size="sm" onClick={refreshNow} disabled={!!refreshing}>
            {refreshing ? <Loader2 className="animate-spin" /> : <RefreshCw />} {refreshing ? `Checking ${refreshing}…` : "Refresh"}
          </Button>
        )}
      </div>

      {!groups.length && !refreshing && (
        <div className="rounded-[var(--radius)] border border-dashed border-lace bg-card p-10 text-center">
          <p className="font-serif text-2xl italic">No trends yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">They arrive every Monday morning. Tap Refresh to get this week&apos;s now.</p>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.key} className="space-y-3">
          <h2 className="font-serif text-2xl italic">{g.label}</h2>
          {/* 5 in a row on larger screens; a swipeable row on phones */}
          <div className="-mx-4 grid snap-x auto-cols-[44%] grid-flow-col gap-3 overflow-x-auto px-4 pb-1 sm:auto-cols-[30%] md:mx-0 md:grid-flow-row md:grid-cols-5 md:overflow-visible md:px-0">
            {g.trends.map((t, i) => (
              <Tile key={t.id} t={t} i={i} onOpen={() => setOpen(t)} />
            ))}
          </div>
        </section>
      ))}

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="bottom" className="max-h-[90dvh]">
          {open && (
            <>
              <div className="px-5 pb-3 pt-5 pr-14">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
                  {"🔥".repeat(Math.max(1, Math.min(5, open.heat ?? 3)))} · {labelize(open.category)}
                </p>
                <SheetTitle className="italic">{open.title}</SheetTitle>
              </div>
              <Detail t={open} wardrobe={wardrobe} />
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
