"use client";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="py-10">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {error.message?.includes("database") || error.message?.includes("fetch failed")
          ? "Couldn't reach the database. Check DATABASE_URL in .env.local and run npm run db:setup."
          : "Try again. If it keeps happening, check the server logs."}
      </p>
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
