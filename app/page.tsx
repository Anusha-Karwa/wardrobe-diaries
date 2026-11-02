import Link from "next/link";
import { ArrowRight, Heart, Plus, Wand2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EnsureDrop } from "@/components/ensure-drop";
import { Runway, type RunwayLook } from "@/components/home/runway";
import { WardrobeHero } from "@/components/home/wardrobe-hero";
import { FadeIn } from "@/components/home/fade-in";
import { Sticker, Tape } from "@/components/diary/stickers";
import { ShopButtons } from "@/components/buy-card";
import { shopLinks } from "@/lib/shopping";
import { dailyDropWithOutfit, getDrop, isoDate, mondayOf, todayIST, type WeeklyPayload } from "@/lib/drops";
import { getItemsByIds, getProfile, listItems, listLookbook } from "@/lib/queries";
import { getCurrentTrends } from "@/lib/trends";
import type { Item } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let dbError: string | null = null;
  const profile = await getProfile().catch((err: Error) => {
    dbError = describeDbError(err);
    return null;
  });
  if (!profile) {
    return (
      <Card>
        <p className="text-sm">
          Couldn&apos;t reach the database. Check <code>DATABASE_URL</code> and run <code>npm run db:setup</code>.
        </p>
        {dbError && <p className="text-sm text-muted-foreground">Reason: {dbError}</p>}
      </Card>
    );
  }

  const today = todayIST();
  const [items, daily, weekly, saved, trends] = await Promise.all([
    listItems(),
    dailyDropWithOutfit(isoDate(today)),
    getDrop<WeeklyPayload>("weekly", isoDate(mondayOf(today))),
    listLookbook().catch(() => []),
    getCurrentTrends().catch(() => []),
  ]);
  const h = today.getHours();
  const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";

  // Runway: today's drop first, then a few saved looks, each gliding in and out.
  const savedItems = await getItemsByIds(Array.from(new Set(saved.slice(0, 3).flatMap((o) => o.item_ids))));
  const byId = new Map(savedItems.map((i) => [i.id, i]));
  const looks: RunwayLook[] = [];
  if (daily?.outfit?.items.length) looks.push({ key: `d-${daily.outfit.id}`, label: daily.payload.headline, name: daily.outfit.name ?? "Today's look", tag: daily.outfit.style_tag, items: daily.outfit.items });
  for (const o of saved.slice(0, 3)) {
    const its = o.item_ids.map((id) => byId.get(id)).filter((i): i is Item => !!i);
    if (its.length >= 2) looks.push({ key: `s-${o.id}`, label: "From your lookbook", name: o.name ?? "Saved look", tag: o.style_tag, items: its });
  }
  // The trending piece you're missing that goes with the most of your clothes, from THIS week's trends.
  const top = trends
    .filter((t) => t.status === "missing")
    .sort((a, b) => Math.max(1, b.pairs_with_item_ids.length) * (b.heat ?? 3) - Math.max(1, a.pairs_with_item_ids.length) * (a.heat ?? 3))[0];
  const missing = top ? { title: top.title, links: shopLinks(top.search_query || top.title), why: top.why_now } : null;
  const missingImage = top?.image_url ?? null;

  return (
    <div className="space-y-7">
      <FadeIn className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-serif text-2xl font-bold text-muted-foreground">Dear diary,</p>
            <h1 className="font-serif text-5xl font-bold leading-[0.95] md:text-6xl">
              <span className="marker">
                {greeting}
                {profile.name ? `, ${profile.name}` : ""}
              </span>
            </h1>
          </div>
          {/* date stamp */}
          <div className="relative mt-1 shrink-0 rotate-3 rounded-xl border-2 border-dashed border-primary/60 bg-white px-3 py-1.5 text-center shadow-sm">
            <p className="font-serif text-lg font-bold leading-none text-primary">{today.toLocaleDateString("en-IN", { weekday: "short" })}</p>
            <p className="font-serif text-3xl font-bold leading-none">{today.getDate()}</p>
            <p className="font-serif text-base font-bold leading-none text-muted-foreground">{today.toLocaleDateString("en-IN", { month: "short" })}</p>
          </div>
        </div>
        <Sticker name="sparkle" size={26} tilt={-12} wiggle className="absolute -top-1 left-[46%] hidden sm:block" />
      </FadeIn>

      {items.length > 0 && (
        <FadeIn delay={0.05} className="paper relative p-3 md:p-5">
          <Tape seed={1} className="-top-2.5 left-6 -rotate-6" />
          <Tape seed={2} className="-top-2.5 right-8 rotate-[5deg]" />
          <Sticker name="heart" size={34} tilt={-14} className="absolute -bottom-3 -left-2 z-10" />
          <Sticker name="flower" size={30} tilt={10} className="absolute -right-2 bottom-16 z-10 hidden md:block" />
          <WardrobeHero items={items} />
        </FadeIn>
      )}

      {items.length > 0 && (
        <p className="flex items-center gap-1.5 pt-2 font-serif text-4xl font-bold leading-none md:justify-center">
          today&apos;s outfit <Sticker name="heart" size={24} tilt={8} />
        </p>
      )}
      {!items.length ? (
        <FadeIn delay={0.1}>
          <Card className="items-center py-10 text-center">
            <p className="font-serif text-2xl italic">Let&apos;s fill your closet</p>
            <p className="max-w-xs text-sm text-muted-foreground">Snap a few clothes or a mirror selfie. Your diary does the rest.</p>
            <Link href="/upload" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">
              <Plus className="size-4" /> Add clothes
            </Link>
          </Card>
        </FadeIn>
      ) : looks.length ? (
        <FadeIn delay={0.05} className="md:mx-auto md:max-w-xl">
          <Runway looks={looks} />
        </FadeIn>
      ) : (
        <EnsureDrop period="daily" />
      )}
      {!weekly && items.length > 0 && <EnsureDrop period="weekly" silent />}

      {weekly && (
        <FadeIn delay={0.15}>
          <Link href="/weekly" className="group relative mx-auto flex max-w-xl -rotate-1 items-center justify-between gap-3 rounded-sm bg-[var(--tape-butter)] px-5 pb-4 pt-5 shadow-[0_10px_18px_rgba(59,42,47,0.12)] transition-transform hover:rotate-0">
            <Tape seed={3} className="-top-2 left-1/2 -translate-x-1/2 rotate-2" />
            <span className="min-w-0">
              <span className="font-serif text-lg font-bold text-muted-foreground">this week&apos;s note ✎</span>
              <span className="block font-serif text-2xl font-bold leading-tight">{weekly.payload.headline}</span>
            </span>
            <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-1" />
          </Link>
        </FadeIn>
      )}

      {missing && (
        <FadeIn delay={0.2}>
          <div className="paper relative flex gap-4 p-4">
            <div className="polaroid relative w-28 shrink-0 -rotate-3 !pb-6">
              <Tape seed={0} className="-top-2.5 left-1/2 h-4 w-14 -translate-x-1/2 rotate-3" />
              {missingImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={missingImage} alt="" className="aspect-[4/5] w-full object-cover" />
              ) : (
                <span className="flex aspect-[4/5] w-full items-center justify-center bg-secondary"><Sticker name="bow" size={40} /></span>
              )}
            </div>
            <Sticker name="star" size={28} tilt={12} className="absolute right-3 top-2" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="font-serif text-lg font-bold text-primary">trending, not in my closet yet…</p>
              <p className="font-serif text-2xl font-bold leading-none">{missing.title}</p>
              {missing.why && <p className="line-clamp-1 text-xs text-muted-foreground">{missing.why}</p>}
              <ShopButtons links={missing.links} className="sm:grid-cols-4" />
            </div>
          </div>
        </FadeIn>
      )}

      <FadeIn delay={0.3} className="grid grid-cols-3 gap-2">
        {[
          { href: "/upload", label: "add clothes", icon: Plus, bg: "var(--tape-pink)", tilt: "-1.5deg" },
          { href: "/style", label: "style me", icon: Wand2, bg: "var(--tape-mint)", tilt: "1deg" },
          { href: "/wishlist", label: "wishlist", icon: Heart, bg: "var(--tape-lilac)", tilt: "-0.5deg" },
        ].map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex flex-col items-center gap-0.5 rounded-sm py-4 font-serif text-xl font-bold shadow-[0_6px_12px_rgba(59,42,47,0.1)] transition-transform hover:-rotate-2"
            style={{ background: a.bg, rotate: a.tilt }}
          >
            <a.icon className="size-5 text-foreground/70" /> {a.label}
          </Link>
        ))}
      </FadeIn>
    </div>
  );
}

/** Turn a database error into a hint that's safe to show (never prints the connection string). */
function describeDbError(err: Error) {
  const msg = err?.message ?? String(err);
  if (!process.env.DATABASE_URL) return "DATABASE_URL is not set on this server (on Vercel: Settings → Environment Variables, then redeploy).";
  if (/relation "?profile"? does not exist/i.test(msg))
    return "the database has no Closet tables. DATABASE_URL probably points at the wrong database, or db:setup hasn't been run on it.";
  if (/password authentication failed/i.test(msg)) return "wrong database password in DATABASE_URL.";
  if (/database "?\w+"? does not exist/i.test(msg)) return "the database named in DATABASE_URL doesn't exist.";
  if (/fetch failed|ENOTFOUND|getaddrinfo/i.test(msg)) return "the database host couldn't be reached (check the host in DATABASE_URL).";
  return msg.replace(/postgres(ql)?:\/\/\S+/gi, "[url]").slice(0, 200);
}
