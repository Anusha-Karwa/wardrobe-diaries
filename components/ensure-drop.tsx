"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const COPY = ["Pulling pieces you haven't worn in a while…", "Pairing colours…", "Checking what's trending…", "Rendering your board…"];

/** If the cron hasn't made today's (or this week's) drop yet, build it now and refresh the page. */
export function EnsureDrop({ period, silent }: { period: "daily" | "weekly"; silent?: boolean }) {
  const router = useRouter();
  const ran = useRef(false);
  const [i, setI] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    fetch("/api/drops/ensure", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ period }) })
      .then((r) => (r.ok ? router.refresh() : setFailed(true)))
      .catch(() => setFailed(true));
  }, [period, router]);

  useEffect(() => {
    if (silent) return;
    const t = setInterval(() => setI((x) => (x + 1) % COPY.length), 2200);
    return () => clearInterval(t);
  }, [silent]);

  if (silent) return null;
  if (failed) return <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">Couldn&apos;t prepare today&apos;s drop. Refresh the page to try again.</p>;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="space-y-3 rounded-2xl border bg-card p-3">
        <div className="aspect-[4/5] animate-pulse rounded-xl bg-muted" />
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" /> {COPY[i]}
        </p>
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
