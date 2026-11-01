"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { AESTHETICS, BUDGET_BANDS, GENDER_PREFS } from "@/lib/taxonomy";
import type { Profile } from "@/lib/queries";
import { cn, labelize } from "@/lib/utils";
import { saveProfileAction } from "./actions";

export function ProfileForm({ initial }: { initial: Profile }) {
  const [p, setP] = useState<Profile>(initial);
  const [pending, startTransition] = useTransition();

  const toggleAesthetic = (a: string) =>
    setP((prev) => ({
      ...prev,
      aesthetics: prev.aesthetics.includes(a) ? prev.aesthetics.filter((x) => x !== a) : [...prev.aesthetics, a],
    }));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveProfileAction(p);
      if (res.ok) toast.success("Profile saved");
      else toast.error(res.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <Card>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={p.name ?? ""} onChange={(e) => setP({ ...p, name: e.target.value })} placeholder="What should your stylist call you?" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="gender">Shop for</Label>
            <NativeSelect id="gender" value={p.gender_pref} onChange={(e) => setP({ ...p, gender_pref: e.target.value })}>
              {GENDER_PREFS.map((g) => (
                <option key={g} value={g}>
                  {labelize(g)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" value={p.city} onChange={(e) => setP({ ...p, city: e.target.value })} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="budget">Budget per item</Label>
          <NativeSelect id="budget" value={p.budget_band} onChange={(e) => setP({ ...p, budget_band: e.target.value })}>
            {BUDGET_BANDS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </Card>

      <Card>
        <div>
          <Label>Aesthetics you love</Label>
          <p className="mt-1 text-xs text-muted-foreground">Pick a few. Your stylist leans towards these.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {AESTHETICS.map((a) => {
            const on = p.aesthetics.includes(a);
            return (
              <button
                type="button"
                key={a}
                onClick={() => toggleAesthetic(a)}
                aria-pressed={on}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  on ? "border-primary bg-primary text-primary-foreground" : "bg-white hover:bg-accent"
                )}
              >
                {labelize(a)}
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <div className="space-y-2">
          <Label htmlFor="notes">Notes for your stylist</Label>
          <Textarea
            id="notes"
            value={p.notes ?? ""}
            onChange={(e) => setP({ ...p, notes: e.target.value })}
            placeholder="e.g. petite, prefer modest necklines, love gold jewellery, no heels"
          />
        </div>
      </Card>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
