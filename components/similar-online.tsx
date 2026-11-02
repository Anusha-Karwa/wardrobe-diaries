"use client";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, Globe, Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { browserCutout } from "@/lib/client/bg-removal";
import type { Item, OnlineMatch } from "@/lib/types";
import { cn, dedupeMatches } from "@/lib/utils";

/**
 * "Similar online" (Google Lens visual matches): near-identical product photos for this item.
 * Tap one to make it the item's picture; its background is then removed in the browser.
 */
export function SimilarOnline({ item, auto, onChange }: { item: Item; auto?: boolean; onChange: (item: Item) => void }) {
  const [matches, setMatches] = useState<OnlineMatch[] | null>(item.online_matches ? dedupeMatches(item.online_matches) : null);
  const [state, setState] = useState<"idle" | "searching" | "error" | "off">("idle");
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const ran = useRef(false);

  async function search(refresh = false) {
    setState("searching");
    setError(null);
    try {
      const res = await fetch(`/api/items/${item.id}/online-match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "search", refresh }),
      });
      if (res.status === 501) return setState("off"); // not configured: hide quietly
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Search failed");
      setMatches(dedupeMatches(body.matches));
      setState("idle");
    } catch (err) {
      setError((err as Error).message);
      setState("error");
    }
  }

  useEffect(() => {
    if (auto && !ran.current && item.online_matches == null) {
      ran.current = true;
      search();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  async function use(i: number) {
    setPicking(i);
    setStatus("Isolating the item from the store photo…");
    try {
      const res = await fetch(`/api/items/${item.id}/online-match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "use", index: i }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't use that photo");
      let updated = body.item as Item;
      onChange(updated);
      // Fallback: the server couldn't isolate it, so remove the photo's background here.
      if (body.needs_bg_removal) {
        try {
          let done = false;
          updated = await browserCutout(updated, (s) => !done && setStatus(s), { source: updated.cutout_url!, keepMethod: "online_match" });
          done = true;
          onChange(updated);
        } catch {
          /* keep the photo with its background */
        }
      }
      toast.success("Using the matching photo as this item's picture");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPicking(null);
      setStatus(null);
    }
  }

  if (state === "off") return null;
  const picked = item.matched_product?.link;

  return (
    <div className="space-y-2 rounded-xl border border-dashed p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Globe className="size-3" /> Matching photos
        </span>
        {matches && state !== "searching" && (
          <button type="button" onClick={() => search(true)} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground" title="Search again (uses one Google Lens search)">
            <RefreshCw className="size-3" /> Search again
          </button>
        )}
      </div>

      {state === "searching" && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin text-primary" /> Searching the web for photos of this exact item…
        </p>
      )}
      {state === "error" && <p className="text-xs text-destructive">{error}</p>}

      {!matches && state === "idle" && (
        <button type="button" onClick={() => search()} className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-2.5 py-1.5 text-xs font-medium hover:bg-accent">
          <Search className="size-3.5" /> Find a matching photo
        </button>
      )}

      {matches && matches.length === 0 && state === "idle" && <p className="text-xs text-muted-foreground">No close matches found on the web for this one.</p>}

      {matches && matches.length > 0 && (
        <>
          <div className="grid grid-cols-4 gap-1.5">
            {matches.map((m, i) => {
              const isPicked = picked === m.link;
              return (
                <button
                  key={m.link}
                  type="button"
                  onClick={() => use(i)}
                  disabled={picking !== null}
                  title="Use as this item's photo"
                  className={cn("group relative flex flex-col overflow-hidden rounded-lg border bg-white text-left", isPicked && "ring-2 ring-primary")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.thumbnail} alt="" className="aspect-square w-full object-contain" loading="lazy" referrerPolicy="no-referrer" />
                  {picking === i && (
                    <span className="absolute inset-0 flex items-center justify-center bg-white/70">
                      <Loader2 className="size-4 animate-spin text-primary" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {status ? (
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> {status}
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">Tap one to use it as this item&apos;s picture. Your own photo stays one tap away (Use crop).</p>
          )}
        </>
      )}

      {item.matched_product && (
        <a href={item.matched_product.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] text-primary hover:underline">
          <ExternalLink className="size-3" /> View image source
        </a>
      )}
    </div>
  );
}
