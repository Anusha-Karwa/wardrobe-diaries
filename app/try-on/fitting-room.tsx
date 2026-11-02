"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import imageCompression from "browser-image-compression";
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronRight,
  Download,
  Footprints,
  Gem,
  Loader2,
  RotateCcw,
  Shirt,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ShopButtons } from "@/components/buy-card";
import { buildSearchQuery, shopLinks } from "@/lib/shopping";
import type { Item } from "@/lib/types";
import { cn, labelize } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Slots: picking a piece swaps whatever was in its slot (a dress replaces top + bottom)
// ---------------------------------------------------------------------------
type Slot = "top" | "bottom" | "full" | "outer" | "shoes" | "bag" | "extra";
const slotOf = (i: Item): Slot =>
  i.category === "topwear" ? "top"
  : i.category === "bottomwear" ? "bottom"
  : i.category === "dress" || i.category === "ethnic_set" ? "full"
  : i.category === "outerwear" ? "outer"
  : i.category === "footwear" ? "shoes"
  : i.category === "bag" ? "bag"
  : "extra";

const TABS: { key: string; label: string; icon: typeof Shirt; match: (i: Item) => boolean }[] = [
  { key: "all", label: "All", icon: Sparkles, match: () => true },
  { key: "top", label: "Tops", icon: Shirt, match: (i) => i.category === "topwear" || i.category === "outerwear" },
  { key: "bottom", label: "Bottoms", icon: Shirt, match: (i) => i.category === "bottomwear" },
  { key: "full", label: "Dresses", icon: Shirt, match: (i) => i.category === "dress" || i.category === "ethnic_set" },
  { key: "shoes", label: "Shoes", icon: Footprints, match: (i) => i.category === "footwear" },
  { key: "bag", label: "Bags", icon: ShoppingBag, match: (i) => i.category === "bag" },
  { key: "extra", label: "Accessories", icon: Gem, match: (i) => i.category === "jewellery" || i.category === "accessory" },
];

function addToLook(look: Item[], it: Item): Item[] {
  if (look.some((x) => x.id === it.id)) return look.filter((x) => x.id !== it.id); // tap again = remove
  const s = slotOf(it);
  let next = look;
  if (s === "full") next = next.filter((x) => !["top", "bottom", "full"].includes(slotOf(x)));
  else if (s === "top" || s === "bottom") next = next.filter((x) => slotOf(x) !== s && slotOf(x) !== "full");
  else if (s === "extra") {
    // Up to 2 accessories: adding a third drops the oldest one.
    const extras = next.filter((x) => slotOf(x) === "extra");
    if (extras.length >= 2) next = next.filter((x) => x.id !== extras[0].id);
  }
  else next = next.filter((x) => slotOf(x) !== s);
  return [...next, it].slice(-6);
}

const LOADING = ["Dressing you in your pieces…", "Matching fabric and fit…", "Setting up the studio light…", "Checking it's picture-perfect…"];

interface Rec {
  id: string;
  title: string;
  price_band: string | null;
  search_query: string;
  category: string | null;
}

export function FittingRoom({
  wardrobe,
  bodyPhotoUrl: initialBody,
  aesthetics,
  recommended,
}: {
  wardrobe: Item[];
  bodyPhotoUrl: string | null;
  aesthetics: string[];
  recommended: Rec[];
}) {
  const params = useSearchParams();
  const byId = useMemo(() => new Map(wardrobe.map((i) => [i.id, i])), [wardrobe]);
  const [look, setLook] = useState<Item[]>(() =>
    (params.get("items") ?? "").split(",").map((id) => byId.get(id)).filter((i): i is Item => !!i).slice(0, 6)
  );
  const [body, setBody] = useState(initialBody);
  const [tab, setTab] = useState("all");
  const [renders, setRenders] = useState<Record<string, string>>({});
  /** The last render shown, kept on screen while the next one is being made (no blank waiting screen). */
  const [shown, setShown] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inflight = useRef<{ key: string; ctrl: AbortController } | null>(null);
  const [msg, setMsg] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const name = params.get("name");

  const lookKey = look.map((i) => i.id).sort().join(",");
  const render = renders[lookKey];
  const onStage = render ?? shown;

  // Style & fit checks (computed from the pieces).
  const cats = look.map((i) => i.category);
  const complete = (cats.includes("topwear") && cats.includes("bottomwear")) || cats.includes("dress") || cats.includes("ethnic_set");
  const forms = look.map((i) => i.formality ?? 2);
  const consistent = look.length > 1 && Math.max(...forms) - Math.min(...forms) <= 1;
  const styleMatch = aesthetics.length > 0 && look.some((i) => i.aesthetic.some((a) => aesthetics.includes(a)));

  async function uploadBody(file: File) {
    setUploading(true);
    try {
      const small = await imageCompression(file, { maxWidthOrHeight: 1600, maxSizeMB: 1.5, useWebWorker: true, fileType: "image/jpeg" });
      const form = new FormData();
      form.append("file", small, "me.jpg");
      const res = await fetch("/api/body-photo", { method: "POST", body: form });
      const b = await res.json();
      if (!res.ok) throw new Error(b.error ?? "Upload failed");
      setBody(b.url);
      setRenders({});
      toast.success("Photo saved. Now pick pieces and tap Try it on.");
    } catch (err) {
      toast.error((err as Error).message, { duration: 8000 });
    } finally {
      setUploading(false);
    }
  }

  async function removeBody() {
    if (!confirm("Delete your photo and every try-on made from it?")) return;
    await fetch("/api/body-photo", { method: "DELETE" });
    setBody(null);
    setRenders({});
    toast("Your photo and try-ons were deleted");
  }

  /** Dress the model in the current look. Called automatically whenever the look changes. */
  async function tryItOn(force = false) {
    if (!look.length || !body) return;
    const key = lookKey;
    inflight.current?.ctrl.abort(); // a newer look replaces an older request
    const ctrl = new AbortController();
    inflight.current = { key, ctrl };
    setBusy(true);
    const timer = setInterval(() => setMsg((m) => (m + 1) % LOADING.length), 2500);
    try {
      const res = await fetch("/api/try-on", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_ids: look.map((i) => i.id), force }),
        signal: ctrl.signal,
      });
      const b = await res.json();
      if (!res.ok) throw new Error(b.error ?? "Try-on failed");
      setRenders((r) => ({ ...r, [key]: b.image_url }));
      if (inflight.current?.key === key) setShown(b.image_url);
    } catch (err) {
      if ((err as Error).name !== "AbortError") toast.error((err as Error).message, { duration: 7000 });
    } finally {
      clearInterval(timer);
      if (inflight.current?.key === key) {
        inflight.current = null;
        setBusy(false);
      }
    }
  }

  // Tap a piece → the model wears it. A short pause lets several quick taps become one render.
  useEffect(() => {
    if (!body || !look.length) return;
    if (renders[lookKey]) {
      setShown(renders[lookKey]);
      return;
    }
    const t = setTimeout(() => tryItOn(), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookKey, body]);

  async function downloadRender() {
    if (!render) return;
    const blob = await (await fetch(render)).blob();
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: `${(name ?? "my-look").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png` }).click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  const tabItems = wardrobe.filter(TABS.find((t) => t.key === tab)!.match);

  // ----- Stage (the podium) -----
  const stage = (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-[520px] overflow-hidden rounded-3xl bg-gradient-to-b from-[#efeeec] to-[#e4e2df]">
      {onStage ? (
        // Shown straight from storage (already a small JPEG), no extra image processing step.
        <Image src={onStage} alt="You wearing this look" fill unoptimized className="object-contain" priority />
      ) : body ? (
        <>
          <Image src={body} alt="Your photo" fill unoptimized className="object-contain" />
          {!look.length && (
            <p className="absolute inset-x-6 bottom-[13%] rounded-full bg-white/90 px-4 py-2 text-center text-sm shadow-sm">Tap any piece in your closet to wear it</p>
          )}
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-white shadow-sm">
            <UserRound className="size-7 text-primary" />
          </span>
          <p className="font-serif text-xl font-semibold">Add your photo once</p>
          <p className="text-sm text-muted-foreground">A full-length photo, standing and facing the camera, in everyday clothes (a t-shirt and jeans is perfect).</p>
          <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="animate-spin" /> : <Camera />} {uploading ? "Checking your photo…" : "Upload my photo"}
          </Button>
          <p className="flex items-start gap-1.5 text-left text-[11px] text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" /> PG-13 only: photos in swimwear, underwear or revealing clothes are rejected, and you&apos;re always shown fully clothed. Use only your own photo. You can delete it anytime.
          </p>
        </div>
      )}
      {/* podium under the plain photo */}
      {!onStage && body && <div className="absolute inset-x-[18%] bottom-[3%] h-[7%] rounded-[50%] bg-white/90 shadow-[0_8px_20px_rgba(0,0,0,0.08)]" />}
      {/* Non-blocking progress: the current look stays visible while the next one is made. */}
      {busy && (
        <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium shadow-sm">
          <Loader2 className="size-3.5 animate-spin text-primary" /> {LOADING[msg]}
        </div>
      )}
      {onStage && (
        <div className="absolute right-3 top-3 flex gap-1.5">
          <button onClick={() => tryItOn(true)} disabled={busy} aria-label="Re-generate this look" title="Re-generate" className="rounded-full bg-white/90 p-2 shadow-sm hover:bg-white disabled:opacity-50">
            <RotateCcw className="size-4" />
          </button>
          <button onClick={downloadRender} disabled={!render} aria-label="Download" className="rounded-full bg-white/90 p-2 shadow-sm hover:bg-white disabled:opacity-50">
            <Download className="size-4" />
          </button>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => (e.target.files?.[0] && uploadBody(e.target.files[0]), (e.target.value = ""))} />
    </div>
  );

  // ----- Left rail of category icons (like the pin) -----
  const rail = (
    <div className="flex gap-2 md:flex-col">
      {[{ key: "me", icon: UserRound, label: "My photo" }, ...TABS.filter((t) => t.key !== "all")].map((t) => (
        <button
          key={t.key}
          title={t.label}
          onClick={() => (t.key === "me" ? fileRef.current?.click() : setTab(t.key))}
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full border bg-white shadow-sm transition-colors hover:bg-accent",
            tab === t.key && "border-primary text-primary"
          )}
        >
          <t.icon className="size-4" />
        </button>
      ))}
    </div>
  );

  // ----- Thumbnails of the current look -----
  const thumbs = (
    <div className="flex gap-1.5 rounded-2xl bg-white/80 p-1.5 shadow-sm md:flex-col">
      {look.length ? (
        look.map((i) => (
          <button key={i.id} onClick={() => setLook((l) => l.filter((x) => x.id !== i.id))} title="Remove" className="group relative size-12 shrink-0 overflow-hidden rounded-xl bg-tile">
            <Image src={i.cutout_url ?? i.crop_url} alt={i.description ?? ""} fill sizes="48px" className="object-contain p-1" />
            <span className="absolute inset-0 hidden items-center justify-center bg-black/40 group-hover:flex">
              <X className="size-4 text-white" />
            </span>
          </button>
        ))
      ) : (
        <p className="px-2 py-3 text-[11px] text-muted-foreground">Pick pieces →</p>
      )}
    </div>
  );

  // ----- Closet picker (left panel on desktop, below on mobile) -----
  const closet = (
    <div className="space-y-3 paper p-4">
      <div className="flex items-center justify-between">
        <p className="font-serif text-3xl font-bold leading-none">my closet</p>
        <span className="text-xs text-muted-foreground">{wardrobe.length} pieces</span>
      </div>
      <div className="flex gap-3 overflow-x-auto border-b pb-2 text-sm">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={cn("shrink-0 pb-1", tab === t.key ? "border-b-2 border-foreground font-semibold" : "text-muted-foreground")}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="grid max-h-[560px] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 md:grid-cols-2">
        {tabItems.map((i) => {
          const on = look.some((x) => x.id === i.id);
          return (
            <button key={i.id} onClick={() => setLook((l) => addToLook(l, i))} className="text-left">
              <div className={cn("relative aspect-square overflow-hidden rounded-xl bg-tile ring-offset-2", on && "ring-2 ring-primary")}>
                <Image src={i.cutout_url ?? i.crop_url} alt={i.description ?? ""} fill sizes="120px" className="object-contain p-2" />
                {on && (
                  <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" />
                  </span>
                )}
              </div>
              <p className="mt-1 truncate text-[11px] font-semibold uppercase">{labelize(i.primary_color)}</p>
              <p className="truncate text-[11px] text-muted-foreground">{labelize(i.subcategory)}</p>
            </button>
          );
        })}
      </div>
    </div>
  );

  // ----- Right panel: Your look, Style & fit, Shop the look, Recommended -----
  const panel = (
    <div className="space-y-4">
      <div className="space-y-3 paper p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Your look{name ? ` · ${name}` : ""}</p>
        {look.length ? (
          <ul className="divide-y">
            {look.map((i) => (
              <li key={i.id}>
                <Link href={`/item/${i.id}`} className="flex items-center gap-3 py-2">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-tile">
                    <Image src={i.cutout_url ?? i.crop_url} alt="" fill sizes="56px" className="object-contain p-1" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold uppercase tracking-wide">{i.brand_visible ?? "Your closet"}</p>
                    <p className="truncate text-sm">{labelize(i.primary_color)} {labelize(i.subcategory).toLowerCase()}</p>
                    <p className="text-xs text-muted-foreground">Owned</p>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Tap pieces in your closet to build a look.</p>
        )}

        <div className="space-y-1.5 border-t pt-3">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Style &amp; fit</p>
          {[
            { ok: complete, label: complete ? "Complete outfit" : "Add a top + bottom, or a dress" },
            { ok: consistent, label: consistent ? "Consistent formality" : "Mixed formality (high-low)" },
            { ok: styleMatch, label: styleMatch ? "Matches your style" : aesthetics.length ? "Outside your usual aesthetic" : "Set your aesthetics in Settings" },
          ].map((c) => (
            <p key={c.label} className="flex items-center gap-2 text-sm">
              <span className={cn("flex size-4 items-center justify-center rounded-full border", c.ok ? "border-emerald-600 bg-emerald-600 text-white" : "text-muted-foreground")}>
                {c.ok && <Check className="size-3" />}
              </span>
              {c.label}
            </p>
          ))}
        </div>

        <Button onClick={() => setShopOpen(true)} disabled={!look.length} className="w-full bg-foreground text-background hover:bg-foreground/90">
          <ShoppingBag /> Shop the look
        </Button>
        {!body && <p className="text-xs text-muted-foreground">Add your photo first to see yourself in it.</p>}
      </div>

      {recommended.length > 0 && (
        <div className="space-y-3 paper p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" /> Recommended for you
          </p>
          <div className="grid grid-cols-3 gap-2">
            {recommended.map((r) => (
              <a key={r.id} href={shopLinks(r.search_query).myntra} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-tile p-2 text-left hover:bg-accent">
                <p className="text-[10px] font-semibold uppercase text-primary">🔥 {labelize(r.category)}</p>
                <p className="line-clamp-3 text-xs leading-snug">{r.title}</p>
                {r.price_band && <p className="mt-1 text-[10px] text-muted-foreground">{r.price_band}</p>}
              </a>
            ))}
          </div>
        </div>
      )}

      {body && (
        <div className="flex items-center justify-between rounded-2xl border border-dashed px-3 py-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" /> Stored at an unguessable link · delete anytime
          </span>
          <span className="flex gap-3">
            <button onClick={() => fileRef.current?.click()} className="hover:text-foreground">
              Replace
            </button>
            <button onClick={removeBody} className="inline-flex items-center gap-1 text-destructive">
              <Trash2 className="size-3" /> Delete
            </button>
          </span>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/style" className="flex size-9 items-center justify-center rounded-full border bg-white" aria-label="Back">
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="font-serif text-5xl font-bold leading-none"><span className="marker">my fitting room</span></h1>
          <p className="text-xs text-muted-foreground">Mix and match your closet, and see it on you.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-[210px_minmax(0,1fr)_270px] md:items-start md:gap-4">
        <div className="order-3 min-w-0 md:order-1">{closet}</div>
        <div className="order-1 min-w-0 space-y-3 md:order-2">
          <div className="flex items-start gap-3">
            <div className="hidden md:block">{rail}</div>
            <div className="min-w-0 flex-1">{stage}</div>
            <div className="hidden md:block">{thumbs}</div>
          </div>
          <div className="flex min-w-0 items-center gap-2 overflow-x-auto md:hidden">{thumbs}</div>
          <div className="min-w-0 overflow-x-auto pb-1 md:hidden">{rail}</div>
        </div>
        <div className="order-2 min-w-0 md:order-3">{panel}</div>
      </div>

      <Sheet open={shopOpen} onOpenChange={setShopOpen}>
        <SheetContent side="bottom">
          <div className="border-b px-5 pb-3 pt-5 pr-14">
            <SheetTitle>Shop the look</SheetTitle>
            <p className="text-sm text-muted-foreground">Find these pieces (or close matches) online.</p>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {look.map((i) => {
              return (
                <div key={i.id} className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-tile">
                      <Image src={i.cutout_url ?? i.crop_url} alt="" fill sizes="48px" className="object-contain p-1" />
                    </div>
                    <p className="text-sm">{i.description}</p>
                  </div>
                  <ShopButtons links={shopLinks(buildSearchQuery(i.description ?? `${i.primary_color} ${i.subcategory}`))} />
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
