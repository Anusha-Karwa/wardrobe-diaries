"use client";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, Heart, Loader2, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ShopButtons } from "@/components/buy-card";
import { shopLinks } from "@/lib/shopping";
import { CATEGORY_GROUPS, type GroupKey } from "@/lib/trend-groups";
import type { BuyCard, Item } from "@/lib/types";
import type { TrendWithMatch } from "@/lib/trends";
import { cn, labelize } from "@/lib/utils";

type View = "now" | "past";
type Show = "all" | "owned" | "missing";
type GroupStatus = "waiting" | "working" | "done" | "failed";

const LOADING = [
  "Checking what's trending on Pinterest…",
  "Reading Vogue India and Elle…",
  "Scanning Myntra and Nykaa “new in”…",
  "Looking at street style…",
  "Matching trends to your closet…",
];

function Thumbs({ ids, wardrobe, label }: { ids: string[]; wardrobe: Item[]; label: string }) {
  const items = ids.map((id) => wardrobe.find((i) => i.id === id)).filter((i): i is Item => !!i);
  if (!items.length) return null;
  return (
    <div className="flex items-center gap-1.5">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="flex gap-1.5 overflow-x-auto">
        {items.slice(0, 5).map((it) => (
          <div key={it.id} className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-tile" title={it.description ?? ""}>
            <Image src={it.cutout_url ?? it.crop_url} alt={it.description ?? ""} fill sizes="40px" className="object-contain p-0.5" />
          </div>
        ))}
      </div>
    </div>
  );
}

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

function TrendCard({ t, wardrobe }: { t: TrendWithMatch; wardrobe: Item[] }) {
  const [saved, setSaved] = useState(false);
  const owned = t.status === "owned";
  const q = t.search_query || t.title;

  async function save() {
    const res = await fetch("/api/wishlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toBuyCard(t)) });
    if (!res.ok) return toast.error("Couldn't save");
    setSaved(true);
    toast.success((await res.json()).duplicate ? "Already in your wishlist" : "Added to your wishlist");
  }

  return (
    <article className="flex flex-col gap-2.5 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground">
            <span className="text-trend-foreground">{"🔥".repeat(Math.max(1, Math.min(5, t.heat ?? 3)))}</span> · {labelize(t.category)}
          </p>
          <h3 className="font-serif text-lg font-semibold leading-tight">{t.title}</h3>
        </div>
        {t.status && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
              owned ? "bg-emerald-100 text-emerald-800" : "bg-accent text-accent-foreground"
            )}
          >
            {owned ? <Check className="size-3" /> : <X className="size-3" />} {owned ? "Owned" : "Missing"}
          </span>
        )}
      </div>

      {t.summary && <p className="text-sm leading-snug">{t.summary}</p>}
      {t.why_now && (
        <p className="text-xs leading-snug text-foreground/75">
          <span className="font-semibold text-foreground">Why now: </span>
          {t.why_now}
        </p>
      )}
      {t.how_to_style && (
        <p className="text-xs leading-snug text-foreground/75">
          <span className="font-semibold text-foreground">How to style: </span>
          {t.how_to_style}
        </p>
      )}

      {owned ? (
        <Thumbs ids={t.owned_item_ids} wardrobe={wardrobe} label="In your closet" />
      ) : (
        <Thumbs ids={t.pairs_with_item_ids} wardrobe={wardrobe} label="Pairs with your" />
      )}
      {t.note && <p className={cn("rounded-xl px-3 py-2 text-sm", owned ? "bg-emerald-50" : "bg-accent/50")}>{t.note}</p>}

      {!owned && (
        <>
          {t.price_band && <p className="text-xs text-muted-foreground">Typical price: {t.price_band}</p>}
          <ShopButtons links={shopLinks(q)} />
          <Button size="sm" variant={saved ? "secondary" : "outline"} onClick={save} disabled={saved}>
            <Heart className={cn(saved && "fill-primary text-primary")} /> {saved ? "In your wishlist" : "Add to wishlist"}
          </Button>
        </>
      )}

      {t.sources?.length ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Sources:{" "}
          {t.sources.map((s, i) => (
            <span key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-foreground">
                {s.title}
              </a>
              {i < t.sources!.length - 1 ? " · " : ""}
            </span>
          ))}
        </p>
      ) : null}
    </article>
  );
}

export function TrendsClient({ current, past, wardrobe }: { current: TrendWithMatch[]; past: TrendWithMatch[]; wardrobe: Item[] }) {
  const router = useRouter();
  const [view, setView] = useState<View>("now");
  const [show, setShow] = useState<Show>("all");
  const [status, setStatus] = useState<Record<string, GroupStatus> | null>(null);
  const [step, setStep] = useState(0);
  const refreshing = status !== null;

  useEffect(() => {
    if (!refreshing) return;
    const t = setInterval(() => setStep((i) => (i + 1) % LOADING.length), 2500);
    return () => clearInterval(t);
  }, [refreshing]);

  async function refreshNow() {
    const groups = CATEGORY_GROUPS.map((g) => g.key);
    const st: Record<string, GroupStatus> = Object.fromEntries(groups.map((g) => [g, "waiting"]));
    setStatus({ ...st, match: "waiting" });
    const batchId = crypto.randomUUID();
    const queue: GroupKey[] = [...groups];
    let failed = 0;
    // 3 groups at a time, one request per group.
    await Promise.all(
      Array.from({ length: 3 }, async () => {
        while (queue.length) {
          const g = queue.shift()!;
          setStatus((s) => ({ ...s!, [g]: "working" }));
          const res = await fetch("/api/trends/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ group: g, batchId }),
          }).catch(() => null);
          if (!res?.ok) failed++;
          setStatus((s) => ({ ...s!, [g]: res?.ok ? "done" : "failed" }));
        }
      })
    );
    setStatus((s) => ({ ...s!, match: "working" }));
    const m = await fetch("/api/trends/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ step: "match" }) }).catch(() => null);
    setStatus(null);
    router.refresh();
    if (!m?.ok || failed) toast.error(failed ? `${failed} group${failed > 1 ? "s" : ""} failed. The rest were updated.` : "Couldn't match trends to your closet");
    else toast.success("Trends updated");
  }

  const list = view === "now" ? current : past;
  const filtered = useMemo(() => list.filter((t) => show === "all" || t.status === show), [list, show]);
  const ownedCount = current.filter((t) => t.status === "owned").length;
  const updated = current.length ? new Date(Math.max(...current.map((t) => +new Date(t.created_at)))) : null;

  const grouped = CATEGORY_GROUPS.map((g) => ({ ...g, trends: filtered.filter((t) => t.group_key === g.key) })).filter((g) => g.trends.length);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">What&apos;s In</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {current.length
              ? `${current.length} trends · ${ownedCount} already in your closet${updated ? ` · updated ${updated.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}` : ""}`
              : "Daily fashion trends, matched against your wardrobe."}
          </p>
        </div>
        <Button onClick={refreshNow} disabled={refreshing} size="sm">
          {refreshing ? <Loader2 className="animate-spin" /> : <RefreshCw />} Refresh now
        </Button>
      </div>

      {refreshing && (
        <div className="space-y-2 rounded-2xl border bg-white p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Loader2 className="size-4 animate-spin text-primary" /> {LOADING[step]}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[...CATEGORY_GROUPS.map((g) => [g.key, g.label] as const), ["match", "Matching your closet"] as const].map(([k, label]) => {
              const s = status?.[k];
              return (
                <span
                  key={k}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs",
                    s === "done" && "bg-emerald-100 text-emerald-800",
                    s === "working" && "bg-trend/30 text-trend-foreground",
                    s === "failed" && "bg-red-100 text-red-800",
                    s === "waiting" && "bg-muted text-muted-foreground"
                  )}
                >
                  {s === "working" && <Loader2 className="size-3 animate-spin" />}
                  {s === "done" && <Check className="size-3" />}
                  {label}
                </span>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">This searches Google for each category, about 1–2 minutes in total.</p>
        </div>
      )}

      {current.length > 0 || past.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="grid grid-cols-2 rounded-xl bg-muted p-1 text-sm font-medium">
              {(["now", "past"] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} className={cn("rounded-lg px-3 py-1.5", view === v ? "bg-white shadow-sm" : "text-muted-foreground")}>
                  {v === "now" ? "This week" : "Past weeks"}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              {(["all", "owned", "missing"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setShow(s)}
                  className={cn("rounded-full border px-2.5 py-1 text-xs", show === s ? "border-primary bg-primary text-primary-foreground" : "bg-white")}
                >
                  {s === "all" ? "All" : s === "owned" ? "Owned ✓" : "Missing"}
                </button>
              ))}
            </div>
          </div>

          {grouped.length ? (
            grouped.map((g) => (
              <section key={g.key} className="space-y-3">
                <h2 className="text-xl font-semibold">{g.label}</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {g.trends.map((t) => (
                    <TrendCard key={t.id} t={t} wardrobe={wardrobe} />
                  ))}
                </div>
              </section>
            ))
          ) : (
            <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              {view === "past" ? "No older trends yet. They appear here after the next refresh." : "Nothing here with this filter."}
            </p>
          )}
        </>
      ) : (
        !refreshing && (
          <div className="rounded-2xl border border-dashed p-10 text-center">
            <p className="font-medium">No trends yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Closet researches Pinterest, Vogue India, Elle and Myntra/Ajio/Nykaa trend pages with Google Search, then checks what you already own.
            </p>
            <Button className="mt-4" onClick={refreshNow}>
              <RefreshCw /> Find this week&apos;s trends
            </Button>
          </div>
        )
      )}
    </div>
  );
}
