"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { BOARD_W, CONTENT_H, layoutBoard } from "@/lib/board-layout";
import type { Item } from "@/lib/types";
import { labelize } from "@/lib/utils";

export interface RunwayLook {
  key: string;
  label: string; // "Today's drop", "From your lookbook"
  name: string;
  tag: string | null;
  items: Item[];
}

const pct = (v: number, total: number) => `${(v / total) * 100}%`;
/** Each piece enters from its own side, so the look assembles itself. */
const from = (i: number) => [
  { x: -60, y: -20, rotate: -12 },
  { x: 50, y: 40, rotate: 10 },
  { x: -40, y: 60, rotate: 8 },
  { x: 60, y: -30, rotate: -8 },
  { x: 0, y: 70, rotate: 14 },
  { x: -70, y: 10, rotate: -6 },
][i % 6];

/** Home "runway": outfit pieces glide onto the stage one by one, hold, drift away, and the next look comes in. */
export function Runway({ looks }: { looks: RunwayLook[] }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const look = looks[i % looks.length];

  useEffect(() => {
    if (looks.length < 2 || paused || reduce) return;
    const t = setTimeout(() => setI((x) => (x + 1) % looks.length), 6500);
    return () => clearTimeout(t);
  }, [i, looks.length, paused, reduce]);

  if (!look) return null;
  const placements = layoutBoard(look.items);
  // Stage only uses the board's content area (no footer).
  const H = CONTENT_H;

  return (
    <div className="space-y-3" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="relative overflow-hidden rounded-[2rem] border border-dashed border-lace bg-gradient-to-b from-white to-[#fbefec] shadow-[0_18px_40px_rgba(200,16,46,0.08)]" style={{ aspectRatio: `${BOARD_W}/${H}` }}>
        {/* soft spotlight + podium */}
        <div className="pointer-events-none absolute inset-x-[12%] bottom-[4%] h-[9%] rounded-[50%] bg-[#f7e2dd] blur-[1px]" />
        <AnimatePresence mode="popLayout">
          {placements.map(({ item, slot }, k) => (
            <motion.div
              key={`${look.key}:${item.id}`}
              className="absolute"
              style={{ left: pct(slot.x, BOARD_W), top: pct(slot.y, H), width: pct(slot.w, BOARD_W), height: pct(slot.h, H) }}
              initial={reduce ? false : { opacity: 0, scale: 0.85, ...from(k) }}
              animate={{ opacity: 1, scale: 1, x: 0, y: 0, rotate: 0, transition: { type: "spring", stiffness: 120, damping: 16, delay: reduce ? 0 : 0.12 * k } }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, ...from(k + 3), transition: { duration: 0.45, delay: 0.05 * k } }}
            >
              <div className="relative size-full animate-drift" style={{ animationDelay: `${-k * 0.9}s` }}>
                <Image
                  src={item.cutout_url ?? item.crop_url}
                  alt={item.description ?? labelize(item.subcategory)}
                  fill
                  sizes="(max-width: 768px) 45vw, 22vw"
                  className={item.cutout_url ? "object-contain drop-shadow-[0_10px_12px_rgba(74,24,32,0.18)]" : "rounded-2xl object-cover shadow-md"}
                />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          <motion.div
            key={look.key}
            className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-primary shadow-sm"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            {look.label}
          </motion.div>
        </AnimatePresence>

        {looks.length > 1 && (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {looks.map((l, k) => (
              <button
                key={l.key}
                onClick={() => setI(k)}
                aria-label={`Show ${l.name}`}
                className={`h-1.5 rounded-full transition-all ${k === i % looks.length ? "w-6 bg-primary" : "w-1.5 bg-lace"}`}
              />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={look.key}
          className="flex items-end justify-between gap-3"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
        >
          <div className="min-w-0">
            <p className="truncate font-serif text-2xl font-semibold italic leading-tight">{look.name}</p>
            {look.tag && <p className="text-sm font-semibold text-primary">{labelize(look.tag)}</p>}
          </div>
          <Link
            href={`/try-on?items=${look.items.map((x) => x.id).join(",")}&name=${encodeURIComponent(look.name)}`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-bold text-background shadow-md transition-transform hover:scale-[1.03]"
          >
            <Sparkles className="size-4" /> Try it on
          </Link>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
