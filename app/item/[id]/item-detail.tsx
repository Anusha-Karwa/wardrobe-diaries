"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, HelpCircle, ImageIcon, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ReviewCard } from "@/components/review-card";
import { browserCutout, switchToCrop } from "@/lib/client/bg-removal";
import type { Item } from "@/lib/types";
import { labelize } from "@/lib/utils";

export function ItemDetail({ initial, originalUrl }: { initial: Item; originalUrl: string | null }) {
  const router = useRouter();
  const [item, setItem] = useState(initial);
  const [status, setStatus] = useState<string | null>(null);

  async function redoCutout(it: Item) {
    let done = false;
    setStatus("Cleaning up background…");
    try {
      const updated = await browserCutout(it, (s) => !done && setStatus(s));
      setItem(updated);
      toast.success("New cutout saved");
    } catch {
      toast.error("Background removal didn't work for this one");
    } finally {
      done = true;
      setStatus(null);
    }
  }

  const name = labelize(item.subcategory ?? item.category);
  const missingPrompt = `What's missing to style my ${item.description ?? name}? Suggest outfits from my wardrobe first, then what to buy.`;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back
      </button>
      <h1 className="text-2xl font-semibold">{name}</h1>

      <div className="grid grid-cols-2 gap-2">
        <Button asChild>
          <Link href={`/style?anchor=${item.id}`}>
            <Wand2 /> Style this
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/stylist?prompt=${encodeURIComponent(missingPrompt)}`}>
            <HelpCircle /> What&apos;s missing?
          </Link>
        </Button>
      </div>

      <ReviewCard
        item={item}
        cutoutStatus={status}
        onChange={setItem}
        onDeleted={() => {
          router.push("/wardrobe");
          router.refresh();
        }}
        onRedoCutout={redoCutout}
        onUseCrop={async (it) => {
          try {
            setItem(await switchToCrop(it.id));
          } catch (err) {
            toast.error((err as Error).message);
          }
        }}
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Suggested in {item.times_suggested} outfit{item.times_suggested === 1 ? "" : "s"}</span>
        <span>Added {new Date(item.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
        {originalUrl && (
          <a href={originalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary">
            <ImageIcon className="size-3" /> Original photo
          </a>
        )}
      </div>
    </div>
  );
}
