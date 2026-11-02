"use client";
import { useState } from "react";
import Link from "next/link";
import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OutfitCard, type BoardOutfit } from "@/components/outfit-board";

export function LookbookClient({ initial }: { initial: (BoardOutfit & { id: string })[] }) {
  const [outfits, setOutfits] = useState(initial);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif text-5xl font-bold leading-none"><span className="marker">my lookbook</span></h1>
        <p className="mt-1 text-muted-foreground">{outfits.length ? `${outfits.length} saved outfit${outfits.length === 1 ? "" : "s"}` : "Outfits you save land here."}</p>
      </div>
      {outfits.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {outfits.map((o) => (
            <OutfitCard key={o.id} outfit={o} compact onDeleted={(id) => setOutfits((os) => os.filter((x) => x.id !== id))} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <p className="font-medium">No saved outfits yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Build some outfits and tap Save on the ones you love.</p>
          <Button asChild className="mt-4">
            <Link href="/style">
              <Wand2 /> Style me
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
