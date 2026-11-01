"use client";
import { useState } from "react";
import Image from "next/image";
import { Bookmark, BookmarkCheck, Download, Loader2, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BOARD_BG, BOARD_H, BOARD_W, CONTENT_H, layoutBoard } from "@/lib/board-layout";
import type { Item, Outfit } from "@/lib/types";
import { cn, labelize } from "@/lib/utils";

export interface BoardOutfit {
  id?: string;
  name: string | null;
  style_tag: string | null;
  occasion?: string | null;
  reasoning?: string | null;
  missing_piece?: string | null;
  color_story?: string | null;
  item_ids: string[];
  items: Item[];
  board_url?: string | null;
}

const pct = (v: number, total: number) => `${(v / total) * 100}%`;

/** Instant CSS version of the board: same slots as the PNG renderer. */
export function BoardCanvas({ outfit, className }: { outfit: BoardOutfit; className?: string }) {
  const placements = layoutBoard(outfit.items);
  return (
    <div className={cn("relative w-full overflow-hidden rounded-xl", className)} style={{ aspectRatio: `${BOARD_W}/${BOARD_H}`, background: BOARD_BG }}>
      {placements.map(({ item, slot }) => (
        <div
          key={item.id}
          className="absolute"
          style={{ left: pct(slot.x, BOARD_W), top: pct(slot.y, BOARD_H), width: pct(slot.w, BOARD_W), height: pct(slot.h, BOARD_H) }}
        >
          <Image
            src={item.cutout_url ?? item.crop_url}
            alt={item.description ?? ""}
            fill
            sizes="(max-width: 768px) 50vw, 20vw"
            className={cn("object-contain", item.cutout_url ? "drop-shadow-[0_8px_10px_rgba(59,47,42,0.22)]" : "rounded-lg shadow-md")}
          />
        </div>
      ))}
      <div className="absolute inset-x-[4.4%] border-t border-border" style={{ top: pct(CONTENT_H + 10, BOARD_H) }} />
      <div className="absolute inset-x-[4.4%] flex items-start justify-between gap-2" style={{ top: pct(CONTENT_H + 24, BOARD_H) }}>
        <div className="min-w-0">
          <p className="truncate font-serif text-[clamp(13px,3.6cqw,22px)] font-semibold leading-tight">{outfit.name}</p>
          <p className="truncate text-[clamp(9px,2cqw,12px)] text-primary">
            {[outfit.style_tag && labelize(outfit.style_tag), outfit.color_story].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span className="font-serif text-[clamp(10px,2.4cqw,14px)] text-muted-foreground">closet</span>
      </div>
    </div>
  );
}

async function boardBlob(outfit: BoardOutfit, savedId?: string) {
  const res = savedId
    ? await fetch(`/api/outfits/${savedId}/board`)
    : await fetch("/api/outfits/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toInput(outfit, "occasion")),
      });
  if (!res.ok) throw new Error("Couldn't render the board");
  return res.blob();
}

function toInput(o: BoardOutfit, source: string) {
  return {
    name: o.name ?? "Outfit",
    style_tag: o.style_tag ?? "",
    occasion: o.occasion ?? null,
    reasoning: o.reasoning ?? "",
    missing_piece: o.missing_piece ?? null,
    color_story: o.color_story ?? "",
    item_ids: o.item_ids,
    source,
  };
}

const fileName = (o: BoardOutfit) => `${(o.name ?? "outfit").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "outfit"}.png`;

export function OutfitCard({
  outfit,
  source = "occasion",
  onSaved,
  onDeleted,
  compact,
}: {
  outfit: BoardOutfit;
  source?: "anchor" | "occasion" | "agent" | "daily";
  onSaved?: (o: Outfit) => void;
  onDeleted?: (id: string) => void;
  /** Lookbook view: just the board + actions. */
  compact?: boolean;
}) {
  const [savedId, setSavedId] = useState<string | undefined>(outfit.id);
  const [boardUrl, setBoardUrl] = useState<string | null | undefined>(outfit.board_url);
  const [busy, setBusy] = useState<null | "save" | "download" | "share" | "delete">(null);

  async function save() {
    setBusy("save");
    try {
      const res = await fetch("/api/outfits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toInput(outfit, source)),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't save");
      const saved = (await res.json()) as Outfit;
      setSavedId(saved.id);
      setBoardUrl(saved.board_url);
      onSaved?.(saved);
      toast.success("Saved to your Lookbook");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function download() {
    setBusy("download");
    try {
      const blob = await boardBlob(outfit, savedId);
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href: url, download: fileName(outfit) });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    setBusy("share");
    try {
      const blob = await boardBlob(outfit, savedId);
      const file = new File([blob], fileName(outfit), { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: outfit.name ?? "Outfit", text: outfit.reasoning ?? "" });
      } else {
        toast("Sharing isn't supported here, so it was downloaded instead");
        const url = URL.createObjectURL(blob);
        Object.assign(document.createElement("a"), { href: url, download: fileName(outfit) }).click();
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!savedId || !confirm("Remove this outfit from your Lookbook?")) return;
    setBusy("delete");
    const res = await fetch(`/api/outfits/${savedId}`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) return toast.error("Couldn't delete");
    onDeleted?.(savedId);
  }

  const spin = (k: typeof busy) => (busy === k ? <Loader2 className="animate-spin" /> : null);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
      <div className="@container">
        {boardUrl && compact ? (
          <div className="relative w-full overflow-hidden rounded-xl" style={{ aspectRatio: `${BOARD_W}/${BOARD_H}` }}>
            <Image src={boardUrl} alt={outfit.name ?? "Outfit board"} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
          </div>
        ) : (
          <BoardCanvas outfit={outfit} />
        )}
      </div>

      {!compact && (
        <div className="space-y-1.5 px-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="font-serif text-lg font-semibold leading-tight">{outfit.name}</h3>
            {outfit.style_tag && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] text-accent-foreground">{labelize(outfit.style_tag)}</span>}
          </div>
          {outfit.color_story && <p className="text-xs font-medium text-primary">{outfit.color_story}</p>}
          {outfit.reasoning && <p className="text-sm leading-snug text-foreground/80">{outfit.reasoning}</p>}
          {outfit.missing_piece && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Would be even better with:</span> {outfit.missing_piece}
            </p>
          )}
        </div>
      )}

      <div className={cn("grid gap-2", compact ? "grid-cols-3" : "grid-cols-3")}>
        {compact ? (
          <Button size="sm" variant="outline" onClick={remove} disabled={!!busy} className="text-destructive">
            {spin("delete") ?? <Trash2 />} Delete
          </Button>
        ) : (
          <Button size="sm" onClick={save} disabled={!!busy || !!savedId}>
            {spin("save") ?? (savedId ? <BookmarkCheck /> : <Bookmark />)} {savedId ? "Saved" : "Save"}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={download} disabled={!!busy}>
          {spin("download") ?? <Download />} Download
        </Button>
        <Button size="sm" variant="outline" onClick={share} disabled={!!busy}>
          {spin("share") ?? <Share2 />} Share
        </Button>
      </div>
    </div>
  );
}
