"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, Check, Heart, Loader2, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PairsWith, ShopButtons } from "@/components/buy-card";
import { shopLinks } from "@/lib/shopping";
import { COLOR_SWATCH } from "@/lib/taxonomy";
import type { Item, WishlistItem } from "@/lib/types";
import { cn, labelize } from "@/lib/utils";

export function WishlistClient({ initial, wardrobe }: { initial: WishlistItem[]; wardrobe: Item[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function setBought(w: WishlistItem, bought: boolean) {
    setBusy(w.id);
    const res = await fetch(`/api/wishlist/${w.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bought }) });
    setBusy(null);
    if (!res.ok) return toast.error("Couldn't update");
    const updated = (await res.json()) as WishlistItem;
    setItems((xs) => xs.map((x) => (x.id === w.id ? updated : x)).sort((a, b) => Number(a.bought) - Number(b.bought)));
    if (bought)
      toast.success("Nice buy! Upload a photo of it to add it to your wardrobe.", {
        action: { label: "Upload", onClick: () => router.push("/upload") },
        duration: 8000,
      });
  }

  async function remove(w: WishlistItem) {
    setBusy(w.id);
    const res = await fetch(`/api/wishlist/${w.id}`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) return toast.error("Couldn't remove");
    setItems((xs) => xs.filter((x) => x.id !== w.id));
  }

  const toBuy = items.filter((w) => !w.bought).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-semibold">Wishlist</h1>
        <p className="mt-1 text-muted-foreground">
          {items.length ? `${toBuy} to buy${items.length - toBuy ? ` · ${items.length - toBuy} bought` : ""}` : "Buy suggestions you save land here."}
        </p>
      </div>

      {!items.length && (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <Heart className="mx-auto size-8 text-primary" />
          <p className="mt-2 font-medium">Nothing saved yet</p>
          <p className="mt-1 text-sm text-muted-foreground">When an outfit or the stylist suggests something to buy, tap “Add to wishlist”.</p>
          <Button asChild className="mt-4">
            <Link href="/style">Style me</Link>
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((w) => {
          const colour = w.attributes?.primary_color as keyof typeof COLOR_SWATCH | undefined;
          return (
            <div key={w.id} className={cn("flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm", w.bought && "opacity-70")}>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 size-8 shrink-0 rounded-lg border border-black/10" style={{ background: colour ? COLOR_SWATCH[colour] ?? "#f1ece6" : "#f1ece6" }} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                    {w.bought ? "Bought" : "To buy"} · {labelize(w.category)}
                  </p>
                  <p className={cn("font-medium leading-snug", w.bought && "line-through decoration-1")}>{w.title}</p>
                  {w.price_band && <p className="text-xs text-muted-foreground">{w.price_band}</p>}
                </div>
                <button onClick={() => remove(w)} disabled={busy === w.id} aria-label="Remove" className="rounded-full p-1 text-muted-foreground hover:bg-accent">
                  <Trash2 className="size-4" />
                </button>
              </div>
              {w.why && <p className="text-sm leading-snug text-foreground/80">{w.why}</p>}
              <PairsWith ids={w.pairs_with_item_ids} wardrobe={wardrobe} />
              {w.bought ? (
                <div className="flex flex-col gap-2 rounded-xl bg-accent/60 p-3 text-sm">
                  <span>Got it? Add a photo so Closet can style it with everything else.</span>
                  <div className="flex gap-2">
                    <Button asChild size="sm">
                      <Link href="/upload">
                        <Camera /> Upload a photo
                      </Link>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setBought(w, false)} disabled={busy === w.id}>
                      <Undo2 /> Not bought
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {w.search_query && <ShopButtons links={shopLinks(w.search_query)} />}
                  <Button size="sm" variant="outline" onClick={() => setBought(w, true)} disabled={busy === w.id}>
                    {busy === w.id ? <Loader2 className="animate-spin" /> : <Check />} Mark as bought
                  </Button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
