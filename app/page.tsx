import Link from "next/link";
import { ArrowRight, Heart, Plus, Wand2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EnsureDrop } from "@/components/ensure-drop";
import { Runway, type RunwayLook } from "@/components/home/runway";
import { WardrobeHero } from "@/components/home/wardrobe-hero";
import { FadeIn } from "@/components/home/fade-in";
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
      <FadeIn>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
          {today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1 className="mt-1 font-serif text-4xl font-semibold italic leading-[1.05] md:text-5xl">
          {greeting}
          {profile.name ? `, ${profile.name}` : ""}
        </h1>
      </FadeIn>

      {items.length > 0 && (
        <FadeIn delay={0.05}>
          <WardrobeHero items={items} />
        </FadeIn>
      )}

      {items.length > 0 && <p className="-mb-3 font-serif text-2xl italic md:text-center">Today&apos;s drop</p>}
      {!items.length ? (
        <FadeIn delay={0.1}>
          <Card className="items-center py-10 text-center">
            <p className="font-serif text-2xl italic">Let&apos;s fill your closet</p>
            <p className="max-w-xs text-sm text-muted-foreground">Snap a few clothes or a mirror selfie. Closet does the rest.</p>
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
          <Link href="/weekly" className="group flex items-center justify-between gap-3 rounded-full bg-foreground px-5 py-3 text-background shadow-md">
            <span className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-trend">Weekly drop</span>
              <span className="block truncate font-serif text-lg italic">{weekly.payload.headline}</span>
            </span>
            <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-1" />
          </Link>
        </FadeIn>
      )}

      {missing && (
        <FadeIn delay={0.2}>
          <div className="flex gap-4 rounded-[var(--radius)] border border-dashed border-lace bg-card p-3 shadow-[0_6px_20px_rgba(200,16,46,0.05)]">
            {missingImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={missingImage} alt="" className="h-32 w-24 shrink-0 rounded-2xl object-cover" />
            ) : (
              <span className="flex size-24 shrink-0 items-center justify-center rounded-2xl bg-secondary text-3xl">🎀</span>
            )}
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Trending · not in your closet</p>
              <p className="font-serif text-lg font-semibold italic leading-tight">{missing.title}</p>
              {missing.why && <p className="line-clamp-1 text-xs text-muted-foreground">{missing.why}</p>}
              <ShopButtons links={missing.links} className="sm:grid-cols-4" />
            </div>
          </div>
        </FadeIn>
      )}

      <FadeIn delay={0.3} className="grid grid-cols-3 gap-2">
        {[
          { href: "/upload", label: "Add clothes", icon: Plus },
          { href: "/style", label: "Style me", icon: Wand2 },
          { href: "/wishlist", label: "Wishlist", icon: Heart },
        ].map((a) => (
          <Link key={a.href} href={a.href} className="flex flex-col items-center gap-1 rounded-3xl border border-dashed border-lace bg-card py-4 text-sm font-bold transition-colors hover:bg-secondary">
            <a.icon className="size-5 text-primary" /> {a.label}
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
