"use client";
import Image from "next/image";
import Link from "next/link";
import { useReducedMotion } from "framer-motion";
import type { Item } from "@/lib/types";

/** Your closet gliding past in an endless ribbon. */
export function ClosetRibbon({ items }: { items: Item[] }) {
  const reduce = useReducedMotion();
  if (items.length < 4) return null;
  const row = [...items, ...items];
  return (
    <div className="group relative overflow-hidden rounded-[2rem] py-2 [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
      <div
        className="flex w-max gap-3 group-hover:[animation-play-state:paused]"
        style={reduce ? undefined : { animation: `ribbon ${Math.max(30, items.length * 3)}s linear infinite` }}
      >
        {row.map((it, k) => (
          <Link key={`${it.id}-${k}`} href={`/item/${it.id}`} className="relative size-24 shrink-0 overflow-hidden rounded-3xl border border-dashed border-lace bg-white transition-transform hover:-translate-y-1" tabIndex={k >= items.length ? -1 : 0}>
            <Image src={it.cutout_url ?? it.crop_url} alt={it.description ?? ""} fill sizes="96px" className="object-contain p-2" />
          </Link>
        ))}
      </div>
      <style>{`@keyframes ribbon { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
    </div>
  );
}
