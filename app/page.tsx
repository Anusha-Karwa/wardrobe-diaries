import Link from "next/link";
import { Plus, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getProfile } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let dbError: string | null = null;
  const profile = await getProfile().catch((err: Error) => {
    dbError = describeDbError(err);
    return null;
  });
  const hour = new Date().toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" });
  const h = Number(hour);
  const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">
          {greeting}
          {profile?.name ? `, ${profile.name}` : ""}
        </h1>
        <p className="mt-1 text-muted-foreground">Your daily drop lands here once the wardrobe and trends are set up.</p>
      </div>

      {!profile && (
        <Card className="border-destructive/40">
          <p className="text-sm">
            Couldn&apos;t reach the database. Check <code>DATABASE_URL</code> and run <code>npm run db:setup</code>.
          </p>
          {dbError && <p className="text-sm text-muted-foreground">Reason: {dbError}</p>}
        </Card>
      )}

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
    return "the database has no Closet tables. DATABASE_URL probably points at the wrong database (it should end in /closet?…), or db:setup hasn't been run on it.";
  if (/password authentication failed/i.test(msg)) return "wrong database password in DATABASE_URL.";
  if (/database "?\w+"? does not exist/i.test(msg)) return "the database named in DATABASE_URL doesn't exist.";
  if (/fetch failed|ENOTFOUND|getaddrinfo/i.test(msg)) return "the database host couldn't be reached (check the host in DATABASE_URL).";
  return msg.replace(/postgres(ql)?:\/\/\S+/gi, "[url]").slice(0, 200);
}
