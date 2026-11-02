import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BuyCard } from "@/components/buy-card";
import { EnsureDrop } from "@/components/ensure-drop";
import { getDrop, isoDate, mondayOf, todayIST, type WeeklyPayload } from "@/lib/drops";
import { listItems } from "@/lib/queries";
import { getCurrentTrends } from "@/lib/trends";
import { labelize } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function WeeklyPage() {
  const monday = mondayOf(todayIST());
  const [drop, items, trends] = await Promise.all([getDrop<WeeklyPayload>("weekly", isoDate(monday)), listItems(), getCurrentTrends()]);
  if (!drop) {
    return (
      <div className="space-y-4">
        <h1 className="font-serif text-5xl font-bold leading-none"><span className="marker">this week&apos;s note</span></h1>
        <p className="text-muted-foreground">Preparing this week&apos;s drop…</p>
        <EnsureDrop period="weekly" />
      </div>
    );
  }
  const p = drop.payload;
  const top = p.top_trend_ids.map((id) => trends.find((t) => t.id === id)).filter((t) => !!t);
  const byId = new Map(items.map((i) => [i.id, i]));

  return (
    <div className="space-y-8">
      <header className="rounded-2xl bg-foreground p-5 text-background">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-trend">
          Weekly drop · week of {monday.toLocaleDateString("en-IN", { day: "numeric", month: "long" })}
        </p>
        <h1 className="mt-1 font-serif text-3xl font-semibold leading-tight">{p.headline}</h1>
        {p.intro && <p className="mt-2 text-sm text-background/80">{p.intro}</p>}
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">This week&apos;s top trends</h2>
        <ol className="space-y-2">
          {top.map((t, i) => (
            <li key={t!.id} className="flex items-start gap-3 paper p-3">
              <span className="font-serif text-2xl font-semibold text-primary">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium leading-snug">
                  {t!.title} <span className="text-xs">{"🔥".repeat(Math.max(1, Math.min(5, t!.heat ?? 3)))}</span>
                </p>
                <p className="text-xs text-muted-foreground">{labelize(t!.category)}</p>
                {t!.summary && <p className="mt-1 text-sm text-foreground/80">{t!.summary}</p>}
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${t!.status === "owned" ? "bg-emerald-100 text-emerald-800" : "bg-accent text-accent-foreground"}`}>
                {t!.status === "owned" ? "Owned ✓" : "Missing"}
              </span>
            </li>
          ))}
        </ol>
        <Button asChild variant="outline" size="sm">
          <Link href="/trends">
            All trends <ArrowRight />
          </Link>
        </Button>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold">Your {p.smart_buys.length} smart buys</h2>
          <p className="text-sm text-muted-foreground">Trending pieces you don&apos;t own that work with the most of your clothes.</p>
        </div>
        {p.smart_buys.length ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {p.smart_buys.map((b, i) => (
              <BuyCard key={i} card={b} wardrobe={items} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing missing this week: you&apos;re on trend.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Already in your closet</h2>
        {p.in_your_closet.length ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {p.in_your_closet.map((c) => (
              <div key={c.trend_id} className="space-y-2 rounded-2xl border bg-emerald-50/60 p-4">
                <p className="font-medium">{c.title}</p>
                <div className="flex gap-2">
                  {c.item_ids.map((id) => byId.get(id)).filter((x) => !!x).slice(0, 4).map((it) => (
                    <Link key={it!.id} href={`/item/${it!.id}`} className="relative size-16 overflow-hidden rounded-xl bg-tile">
                      <Image src={it!.cutout_url ?? it!.crop_url} alt={it!.description ?? ""} fill sizes="64px" className="object-contain p-1" />
                    </Link>
                  ))}
                </div>
                {c.tip && <p className="text-sm text-foreground/80">{c.tip}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
            None of this week&apos;s trends are in your closet yet. The smart buys above are the quickest way in.
          </p>
        )}
      </section>
    </div>
  );
}
