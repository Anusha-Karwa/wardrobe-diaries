"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, Plus, Sparkles, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { OutfitCard } from "@/components/outfit-board";
import { GapCard } from "@/components/gap-card";
import { ItemImage } from "@/components/item-image";
import { CATEGORIES, OCCASIONS } from "@/lib/taxonomy";
import type { OutfitResult } from "@/lib/outfits";
import type { Item } from "@/lib/types";
import { cn, labelize } from "@/lib/utils";

const WEATHER = ["hot & sunny", "warm", "pleasant", "cool evening", "cold", "rainy"];
const VIBES = ["minimal", "bold", "comfy", "polished", "playful", "romantic", "edgy"];
const LOADING = ["Pairing colours…", "Balancing silhouettes…", "Checking the formality…", "Pulling pieces from your closet…"];

export function StyleClient({ wardrobe }: { wardrobe: Item[] }) {
  const params = useSearchParams();
  const initialAnchor = params.get("anchor");
  const [mode, setMode] = useState<"occasion" | "anchor">(initialAnchor ? "anchor" : "occasion");
  const [anchorId, setAnchorId] = useState<string | null>(initialAnchor);
  const [occasion, setOccasion] = useState("casual");
  const [weather, setWeather] = useState("pleasant");
  const [vibe, setVibe] = useState("");
  const [pickerCat, setPickerCat] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [loadingIdx, setLoadingIdx] = useState(0);
  const [result, setResult] = useState<OutfitResult | null>(null);
  const autoRan = useRef(false);

  const anchor = wardrobe.find((i) => i.id === anchorId) ?? null;

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setLoadingIdx((i) => (i + 1) % LOADING.length), 1800);
    return () => clearInterval(t);
  }, [loading]);

  async function generate(override?: { mode: "anchor" | "occasion"; anchorItemId?: string }) {
    const m = override?.mode ?? mode;
    const body =
      m === "anchor"
        ? { mode: "anchor", anchorItemId: override?.anchorItemId ?? anchorId, count: 5 }
        : { mode: "occasion", occasion, weather, vibe: vibe || undefined, count: 4 };
    if (m === "anchor" && !body.anchorItemId) return toast("Pick an item to style first");
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/outfits/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setResult(data);
      if (!data.outfits.length && !data.gaps.length) toast("No outfits this time. Try another occasion or item.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // "Style this" from an item page: run straight away.
  useEffect(() => {
    if (initialAnchor && !autoRan.current && wardrobe.some((i) => i.id === initialAnchor)) {
      autoRan.current = true;
      generate({ mode: "anchor", anchorItemId: initialAnchor });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAnchor]);

  if (!wardrobe.length) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-3xl font-semibold">Style me</h1>
        <p className="mx-auto mt-2 max-w-sm text-muted-foreground">Add some clothes first, then Closet can build outfits from them.</p>
        <Button asChild className="mt-6">
          <Link href="/upload">
            <Plus /> Add clothes
          </Link>
        </Button>
      </div>
    );
  }

  const presentCats = CATEGORIES.filter((c) => wardrobe.some((i) => i.category === c));
  const pickerItems = pickerCat === "all" ? wardrobe : wardrobe.filter((i) => i.category === pickerCat);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Style me</h1>
        <p className="mt-1 text-muted-foreground">Outfits built only from what you own.</p>
      </div>

      {/* Mode switch */}
      <div className="grid grid-cols-2 rounded-xl bg-muted p-1 text-sm font-medium">
        {(["occasion", "anchor"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn("rounded-lg py-2 transition-colors", mode === m ? "bg-white shadow-sm" : "text-muted-foreground")}
          >
            {m === "occasion" ? "For an occasion" : "Around one item"}
          </button>
        ))}
      </div>

      {mode === "occasion" ? (
        <div className="space-y-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Occasion</span>
              <NativeSelect value={occasion} onChange={(e) => setOccasion(e.target.value)}>
                {OCCASIONS.map((o) => (
                  <option key={o} value={o}>
                    {labelize(o)}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Weather</span>
              <NativeSelect value={weather} onChange={(e) => setWeather(e.target.value)}>
                {WEATHER.map((w) => (
                  <option key={w} value={w}>
                    {labelize(w)}
                  </option>
                ))}
              </NativeSelect>
            </label>
          </div>
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Vibe (optional)</span>
            <Input value={vibe} onChange={(e) => setVibe(e.target.value)} placeholder="e.g. effortless but put-together" />
            <div className="flex flex-wrap gap-1.5">
              {VIBES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVibe(vibe === v ? "" : v)}
                  className={cn("rounded-full border px-2.5 py-1 text-xs", vibe === v ? "border-primary bg-primary text-primary-foreground" : "bg-white hover:bg-accent")}
                >
                  {labelize(v)}
                </button>
              ))}
            </div>
          </div>
          <Button className="w-full" size="lg" onClick={() => generate()} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <Sparkles />} Build 3–5 outfits
          </Button>
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          {anchor ? (
            <div className="flex items-center gap-3">
              <ItemImage item={anchor} className="size-20 shrink-0" sizes="80px" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Styling around</p>
                <p className="line-clamp-2 text-sm font-medium">{anchor.description}</p>
              </div>
              <button onClick={() => setAnchorId(null)} aria-label="Pick another item" className="rounded-full p-1 hover:bg-accent">
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium">Pick one item</p>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {["all", ...presentCats].map((c) => (
                  <button
                    key={c}
                    onClick={() => setPickerCat(c)}
                    className={cn("shrink-0 rounded-full border px-2.5 py-1 text-xs", pickerCat === c ? "border-primary bg-primary text-primary-foreground" : "bg-white")}
                  >
                    {labelize(c)}
                  </button>
                ))}
              </div>
              <div className="grid max-h-80 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
                {pickerItems.map((it) => (
                  <button key={it.id} onClick={() => setAnchorId(it.id)} className="rounded-xl ring-primary hover:ring-2" title={it.description ?? ""}>
                    <ItemImage item={it} sizes="100px" />
                  </button>
                ))}
              </div>
            </>
          )}
          <Button className="w-full" size="lg" onClick={() => generate()} disabled={loading || !anchor}>
            {loading ? <Loader2 className="animate-spin" /> : <Wand2 />} Style it 5 ways
          </Button>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" /> {LOADING[loadingIdx]}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-6">
          {result.note && <p className="rounded-xl bg-accent/60 p-3 text-sm">{result.note}</p>}
          {result.outfits.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {result.outfits.map((o) => (
                <OutfitCard key={o.key} outfit={o} source={mode} />
              ))}
            </div>
          )}
          {result.gaps.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">What would complete these looks</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {result.gaps.map((g, i) => (
                  <GapCard key={i} gap={g} wardrobe={wardrobe} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
