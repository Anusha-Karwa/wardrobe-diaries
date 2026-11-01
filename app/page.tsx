import Link from "next/link";
import { Plus, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getProfile } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const profile = await getProfile().catch(() => null);
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
