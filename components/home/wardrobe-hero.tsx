"use client";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { Item } from "@/lib/types";
import { cn, labelize } from "@/lib/utils";

/**
 * Home hero: an interactive wardrobe (inspired by a furniture-configurator animation).
 * Your hanging pieces sway on the rail, folded pieces sit on shelves, shoes and jewellery live in drawers.
 * Lights, door (open / wood / glass) and drawers animate; a short intro plays on load.
 */
type Door = "open" | "wood" | "glass";

const HANG = new Set(["topwear", "dress", "outerwear", "ethnic_set"]);
const SHELF = new Set(["bottomwear", "bag"]);
const DRAWER = new Set(["footwear", "jewellery", "accessory"]);
const PER_RAIL = 3;

function Hanger() {
  return (
    <svg viewBox="0 0 40 18" className="mx-auto -mb-1 h-3.5 w-9 text-[#8a5a3c]" aria-hidden="true">
      <path d="M20 1.5a2.2 2.2 0 0 1 2.2 2.2c0 1-.7 1.5-1.4 2-.5.3-.8.6-.8 1.1V8M20 8 3 15.5c-1 .5-.6 1.5.4 1.5h33.2c1 0 1.4-1 .4-1.5L20 8Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="space-y-1">
      <p className="font-serif text-lg font-bold leading-none text-muted-foreground">{label.toLowerCase()}</p>
      <div className="inline-flex rounded-full border border-dashed border-lace bg-white p-0.5">
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            aria-pressed={value === o.v}
            className={cn("rounded-full px-3 py-1 text-xs font-bold transition-colors", value === o.v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}

export function WardrobeHero({ items }: { items: Item[] }) {
  const reduce = useReducedMotion();
  const hanging = useMemo(() => items.filter((i) => HANG.has(i.category)), [items]);
  const shelved = useMemo(() => items.filter((i) => SHELF.has(i.category)).slice(0, 6), [items]);
  const drawered = useMemo(() => items.filter((i) => DRAWER.has(i.category)).slice(0, 6), [items]);

  // Start "closed and dark", then play the intro: lights on → door slides open → drawers slide out.
  const [light, setLight] = useState<"on" | "off">(reduce ? "on" : "off");
  const [door, setDoor] = useState<Door>(reduce ? "open" : "wood");
  const [drawers, setDrawers] = useState<"closed" | "open">(reduce ? "open" : "closed");
  const [page, setPage] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = [setTimeout(() => setLight("on"), 500), setTimeout(() => setDoor("open"), 1300), setTimeout(() => setDrawers("open"), 2100)];
    return () => t.forEach(clearTimeout);
  }, [reduce]);

  const pages = Math.max(1, Math.ceil(hanging.length / PER_RAIL));
  const rail = hanging.slice((page % pages) * PER_RAIL, (page % pages) * PER_RAIL + PER_RAIL);
  const lit = light === "on";
  const spring = { type: "spring" as const, stiffness: 90, damping: 18 };

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,560px)_220px] md:items-center md:justify-center md:gap-8">
      {/* The room */}
      <div
        className={cn(
          "relative overflow-hidden rounded-[2rem] border border-dashed border-lace transition-colors duration-700",
          lit ? "bg-gradient-to-b from-[#f9e7df] to-[#efd3c8]" : "bg-gradient-to-b from-[#c9a9a1] to-[#a8847a]"
        )}
        style={{ aspectRatio: "4 / 3.4" }}
      >
        {/* floor + light spill */}
        <div className={cn("absolute inset-x-0 bottom-0 h-[16%] transition-colors duration-700", lit ? "bg-[#e7c3b5]" : "bg-[#8f6c63]")} />
        <motion.div
          className="pointer-events-none absolute bottom-[2%] left-1/2 h-[16%] w-[70%] -translate-x-1/2 rounded-[50%] bg-[#fff1c9] blur-xl"
          animate={{ opacity: lit ? 0.85 : 0 }}
          transition={{ duration: 0.8 }}
        />
        {/* a little plant, like the pin */}
        <svg viewBox="0 0 40 60" className="absolute bottom-[10%] left-[3%] h-[22%] text-[#6f8f5e]" aria-hidden="true">
          <path d="M20 40c-2-10-12-14-16-24 8 2 14 8 16 18 1-12 6-20 14-26-2 12-8 20-12 30" fill="currentColor" />
          <path d="M11 40h18l-3 18H14z" fill="#c98b6b" />
        </svg>

        {/* The wardrobe */}
        <div className="absolute bottom-[9%] left-1/2 h-[84%] w-[78%] -translate-x-1/2 rounded-t-lg bg-gradient-to-b from-[#c99a73] to-[#a8754f] p-[2.2%] shadow-[0_24px_40px_rgba(74,24,32,0.25)]">
          <div className="relative grid h-full grid-cols-[42%_1fr] grid-rows-[1fr_22%] gap-[2%]">
            {/* inner glow (lights) */}
            <motion.div className="pointer-events-none absolute inset-0 z-10 rounded-sm bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,236,190,0.55),transparent_65%)]" animate={{ opacity: lit ? 1 : 0 }} transition={{ duration: 0.8 }} />
            <motion.div className="pointer-events-none absolute inset-0 z-30 rounded-sm bg-[#3b2620]" animate={{ opacity: lit ? 0 : 0.45 }} transition={{ duration: 0.8 }} />

            {/* Shelves (left) */}
            <div className="relative grid grid-rows-3 overflow-hidden rounded-sm bg-[#f3dccd]">
              {[0, 1, 2].map((r) => (
                <div key={r} className="relative border-b-[5px] border-[#b98560]">
                  <div className="absolute inset-x-[6%] bottom-0 flex items-end justify-center gap-[6%]">
                    {shelved.slice(r * 2, r * 2 + 2).map((it, k) => (
                      <motion.div key={it.id} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + r * 0.15 + k * 0.08 }}>
                        <Link href={`/item/${it.id}`} title={it.description ?? ""} className="relative block size-[clamp(34px,9vw,64px)]">
                          <Image src={it.cutout_url ?? it.crop_url} alt={it.description ?? labelize(it.subcategory)} fill sizes="64px" className="object-contain drop-shadow-sm" />
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Hanging section (right) */}
            <div className="relative overflow-hidden rounded-sm bg-[#f6e4d8]">
              <div className="absolute inset-x-[4%] top-[7%] h-[3px] rounded-full bg-[#9c6b4b]" />
              <div className="absolute inset-x-[4%] top-[6.5%] flex h-[88%] justify-around">
                <AnimatePresence mode="popLayout">
                  {rail.map((it, k) => (
                    <motion.div
                      key={it.id}
                      className="flex w-[31%] flex-col items-center"
                      initial={reduce ? false : { opacity: 0, x: 40 }}
                      animate={{ opacity: 1, x: 0, transition: { ...spring, delay: 0.08 * k } }}
                      exit={{ opacity: 0, x: -40, transition: { duration: 0.25 } }}
                    >
                      <Link href={`/item/${it.id}`} title={it.description ?? ""} className="block w-full origin-top animate-sway" style={{ animationDelay: `${-k * 0.7}s`, animationDuration: `${3 + k * 0.4}s` }}>
                        <Hanger />
                        <div className="relative mx-auto aspect-[3/4.4] w-full">
                          <Image src={it.cutout_url ?? it.crop_url} alt={it.description ?? labelize(it.subcategory)} fill sizes="90px" className="object-contain object-top drop-shadow-md" />
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Door: slides over the hanging section; wood is solid, glass is frosted */}
              <motion.div
                className={cn(
                  "absolute inset-y-0 right-0 z-20 w-full rounded-sm border-l-4 border-[#8a5a3c]",
                  door === "glass" ? "bg-white/35 backdrop-blur-[3px]" : "bg-gradient-to-r from-[#b8835c] to-[#a06c48]"
                )}
                initial={false}
                animate={{ x: door === "open" ? "96%" : "0%" }}
                transition={spring}
              >
                <span className="absolute left-[8%] top-1/2 h-[18%] w-[3px] -translate-y-1/2 rounded-full bg-[#5c3b28]" />
              </motion.div>
            </div>

            {/* Drawers (bottom, full width) */}
            <div className="col-span-2 grid grid-cols-3 gap-[2%]">
              {[0, 1, 2].map((d) => {
                const inside = drawered.slice(d * 2, d * 2 + 2);
                return (
                  <motion.div
                    key={d}
                    className="relative z-20 rounded-sm bg-gradient-to-b from-[#c08d66] to-[#a6724d] shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)]"
                    initial={false}
                    animate={{ y: drawers === "open" ? "-26%" : "0%", scale: drawers === "open" ? 1.04 : 1 }}
                    transition={{ ...spring, delay: drawers === "open" ? d * 0.12 : 0 }}
                  >
                    <span className="absolute left-1/2 top-[30%] h-[3px] w-[26%] -translate-x-1/2 rounded-full bg-[#5c3b28]" />
                    {/* contents peek out when open */}
                    <AnimatePresence>
                      {drawers === "open" && (
                        <motion.div
                          className="absolute inset-x-[6%] -top-[62%] flex h-[70%] items-end justify-center gap-1"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0, transition: { delay: 0.25 + d * 0.1 } }}
                          exit={{ opacity: 0, y: 6 }}
                        >
                          {inside.map((it) => (
                            <Link key={it.id} href={`/item/${it.id}`} title={it.description ?? ""} className="relative h-full w-[45%]">
                              <Image src={it.cutout_url ?? it.crop_url} alt={it.description ?? labelize(it.subcategory)} fill sizes="60px" className="object-contain drop-shadow" />
                            </Link>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Hotspots, like the pin: browse the rail, add a piece */}
        {pages > 1 && (
          <>
            <button onClick={() => setPage((p) => (p - 1 + pages) % pages)} aria-label="Previous pieces" className="absolute left-[2.5%] top-[42%] z-40 flex size-8 items-center justify-center rounded-full bg-white/90 shadow-md hover:bg-white">
              <ChevronLeft className="size-4" />
            </button>
            <button onClick={() => setPage((p) => (p + 1) % pages)} aria-label="More pieces" className="absolute right-[2.5%] top-[42%] z-40 flex size-8 items-center justify-center rounded-full bg-white/90 shadow-md hover:bg-white">
              <ChevronRight className="size-4" />
            </button>
          </>
        )}
        <Link href="/upload" aria-label="Add a piece" className="absolute right-[3%] top-[4%] z-40 flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
          <Plus className="size-4" />
        </Link>
      </div>

      {/* Configurator panel */}
      <div className="flex flex-wrap gap-x-5 gap-y-3 md:flex-col">
        <div className="w-full">
          <p className="font-serif text-4xl font-bold leading-none"><span className="marker">my wardrobe</span></p>
          <p className="text-xs text-muted-foreground">
            {items.length} pieces · {hanging.length} hanging · {drawered.length} in drawers
          </p>
        </div>
        <Seg label="Lights" value={light} onChange={setLight} options={[{ v: "off", l: "Off" }, { v: "on", l: "On" }]} />
        <Seg label="Door" value={door} onChange={setDoor} options={[{ v: "open", l: "Open" }, { v: "wood", l: "Wood" }, { v: "glass", l: "Glass" }]} />
        <Seg label="Drawers" value={drawers} onChange={setDrawers} options={[{ v: "closed", l: "Closed" }, { v: "open", l: "Open" }]} />
        <Link href="/wardrobe" className="inline-flex items-center gap-1 self-end text-sm font-bold text-primary md:self-start">
          See everything →
        </Link>
      </div>
    </div>
  );
}
