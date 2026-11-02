import Link from "next/link";
import { ArrowRight, Plus, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BuyCard } from "@/components/buy-card";
import { OutfitCard } from "@/components/outfit-board";
import { EnsureDrop } from "@/components/ensure-drop";
import { dailyDropWithOutfit, getDrop, isoDate, mondayOf, todayIST, type WeeklyPayload } from "@/lib/drops";
import { getProfile, listItems } from "@/lib/queries";
import { COLOR_SWATCH } from "@/lib/taxonomy";
import { labelize } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let dbError: string | null = null;
  const profile = await getProfile().catch((err: Error) => {
    dbError = describeDbError(err);
    return null;
  });
  if (!profile) {
    return (
      <Card className="border-destructive/40">
        <p className="text-sm">
          Couldn&apos;t reach the database. Check <code>DATABASE_URL</code> and run <code>npm run db:setup</code>.
        </p>
        {dbError && <p className="text-sm text-muted-foreground">Reason: {dbError}</p>}
      </Card>
    );
  }

  const today = todayIST();
  const [items, daily, weekly] = await Promise.all([
    listItems(),
    dailyDropWithOutfit(isoDate(today)),
    getDrop<WeeklyPayload>("weekly", isoDate(mondayOf(today))),
  ]);
  const h = today.getHours();
  const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const isMonday = today.getDay() === 1;

  // Wardrobe stats + colour palette.
  const byCat = new Map<string, number>();
  const byColour = new Map<string, number>();
  for (const i of items) {
    byCat.set(i.category, (byCat.get(i.category) ?? 0) + 1);
    if (i.primary_color) byColour.set(i.primary_color, (byColour.get(i.primary_color) ?? 0) + 1);
  }
  const palette = [...byColour.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">
          {greeting}
          {profile.name ? `, ${profile.name}` : ""}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} · {profile.city}
        </p>
      </div>

      {/* Weekly drop banner (highlighted on Mondays) */}
      {weekly && (
        <Link href="/weekly" className="block">
          <div className={`rounded-2xl p-4 shadow-sm ${isMonday ? "bg-foreground text-background" : "border bg-card"}`}>
            <p className={`text-[11px] font-semibold uppercase tracking-wide ${isMonday ? "text-trend" : "text-primary"}`}>
              {isMonday ? "New · " : ""}Weekly drop
            </p>
            <p className="mt-0.5 font-serif text-xl font-semibold leading-tight">{weekly.payload.headline}</p>
            {weekly.payload.intro && <p className={`mt-1 line-clamp-2 text-sm ${isMonday ? "text-background/80" : "text-muted-foreground"}`}>{weekly.payload.intro}</p>}
            <p className="mt-2 inline-flex items-center gap-1 text-sm font-medium">
              Your {weekly.payload.smart_buys.length} smart buys & this week&apos;s trends <ArrowRight className="size-4" />
            </p>
          </div>
        </Link>
      )}
      {!weekly && items.length > 0 && <EnsureDrop period="weekly" silent />}

      {/* Today's drop */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Today&apos;s drop</p>
            <h2 className="text-2xl font-semibold">{daily?.payload.headline ?? "Outfit of the day"}</h2>
          </div>
          {daily && (
            <span className="text-xs text-muted-foreground">for {labelize(daily.payload.occasion)}</span>
          )}
        </div>

        {!items.length ? (
          <Card className="items-center text-center">
            <p className="font-medium">Your closet is empty</p>
            <p className="text-sm text-muted-foreground">Upload a few photos and your outfit of the day will appear here every morning.</p>
            <Button asChild>
              <Link href="/upload">
                <Plus /> Add clothes
              </Link>
            </Button>
          </Card>
        ) : !daily ? (
          <EnsureDrop period="daily" />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {daily.outfit ? (
              <OutfitCard
                outfit={{ ...daily.outfit, id: undefined, board_url: daily.outfit.board_url }}
                source="occasion"
              />
            ) : (
              <Card>
                <p className="text-sm text-muted-foreground">No complete outfit today. Add a few more pieces (tops, bottoms, shoes) for daily looks.</p>
              </Card>
            )}
            {daily.payload.trending_missing && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">🔥 Trending &amp; missing from your closet</p>
                <BuyCard card={daily.payload.trending_missing} wardrobe={items} />
              </div>
            )}
          </div>
        )}
      </section>

      {/* Wardrobe stats + palette */}
      {items.length > 0 && (
        <Link href="/wardrobe" className="block">
          <Card className="gap-3">
            <div className="flex items-baseline justify-between">
              <p className="font-serif text-lg font-semibold">Your closet</p>
              <span className="text-sm text-muted-foreground">{items.length} pieces</span>
            </div>
            <div className="flex h-4 w-full overflow-hidden rounded-full border border-black/5" title="Your colour palette">
              {palette.map(([c, n]) => (
                <span
                  key={c}
                  title={`${labelize(c)} · ${n}`}
                  style={{ flex: n, background: COLOR_SWATCH[c as keyof typeof COLOR_SWATCH] ?? "#ccc" }}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[...byCat.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([c, n]) => (
                  <span key={c} className="rounded-full bg-muted px-2.5 py-1 text-xs">
                    {labelize(c)} <span className="text-muted-foreground">{n}</span>
                  </span>
                ))}
            </div>
          </Card>
        </Link>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3">
        <Button asChild variant="default" className="h-auto flex-col gap-1 py-4">
          <Link href="/upload">
            <Plus className="size-5" /> Upload
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-auto flex-col gap-1 py-4">
          <Link href="/style">
            <Wand2 className="size-5" /> Style me
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-auto flex-col gap-1 py-4">
          <Link href="/stylist">
            <Sparkles className="size-5" /> Ask stylist
          </Link>
        </Button>
      </div>
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
