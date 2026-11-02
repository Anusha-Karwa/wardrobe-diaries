"use client";
import { useState } from "react";
import { ChevronDown, Crop, Loader2, Save, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ItemImage } from "@/components/item-image";
import { CutoutBadge } from "@/components/cutout-badge";
import { SimilarOnline } from "@/components/similar-online";
import {
  AESTHETICS,
  CATEGORIES,
  COLORS,
  COLOR_SWATCH,
  EMBELLISHMENTS,
  FABRICS,
  FITS,
  LENGTHS,
  METAL_TONES,
  NECKLINES,
  OCCASIONS,
  PATTERNS,
  RISES,
  SEASONS,
  SLEEVE_LENGTHS,
  SLEEVE_STYLES,
  STYLES,
  SUBCATEGORIES_BY_CATEGORY,
  WASHES,
  type Category,
} from "@/lib/taxonomy";
import type { Item } from "@/lib/types";
import { cn, labelize } from "@/lib/utils";

type Draft = Item;

const MAIN_FIELDS: { key: keyof Item; label: string; values: readonly string[] }[] = [
  { key: "pattern", label: "Pattern", values: PATTERNS },
  { key: "sleeve_length", label: "Sleeve", values: SLEEVE_LENGTHS },
  { key: "neckline", label: "Neckline", values: NECKLINES },
  { key: "fit", label: "Fit", values: FITS },
  { key: "length", label: "Length", values: LENGTHS },
  { key: "fabric", label: "Fabric", values: FABRICS },
];
const MORE_FIELDS: { key: keyof Item; label: string; values: readonly string[] }[] = [
  { key: "sleeve_style", label: "Sleeve style", values: SLEEVE_STYLES },
  { key: "rise", label: "Rise", values: RISES },
  { key: "wash", label: "Wash", values: WASHES },
  { key: "embellishment", label: "Embellishment", values: EMBELLISHMENTS },
  { key: "style", label: "Style", values: STYLES },
  { key: "metal_tone", label: "Metal tone", values: METAL_TONES },
];
const CHIP_FIELDS: { key: "occasion" | "season" | "aesthetic" | "secondary_colors"; label: string; values: readonly string[] }[] = [
  { key: "occasion", label: "Occasion", values: OCCASIONS },
  { key: "season", label: "Season", values: SEASONS },
  { key: "aesthetic", label: "Aesthetic", values: AESTHETICS },
  { key: "secondary_colors", label: "Other colours", values: COLORS },
];

const EDITABLE_KEYS = [
  "category", "subcategory", "primary_color", "secondary_colors", "pattern", "sleeve_length", "sleeve_style",
  "neckline", "fit", "length", "rise", "fabric", "wash", "embellishment", "style", "metal_tone", "occasion",
  "season", "formality", "aesthetic", "brand_visible", "size", "description",
] as const;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Select({ value, values, onChange }: { value: string | null; values: readonly string[]; onChange: (v: string) => void }) {
  const list = value && !values.includes(value) ? [value, ...values] : values;
  return (
    <NativeSelect value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="h-9 text-sm">
      {list.map((v) => (
        <option key={v} value={v}>
          {labelize(v)}
        </option>
      ))}
    </NativeSelect>
  );
}

export function ReviewCard({
  item,
  cutoutStatus,
  onChange,
  onDeleted,
  onRedoCutout,
  onUseCrop,
  autoFindOnline,
}: {
  item: Item;
  /** Progress text while a browser cutout runs for this item. */
  cutoutStatus?: string | null;
  onChange: (item: Item) => void;
  onDeleted: (id: string) => void;
  onRedoCutout: (item: Item) => void;
  onUseCrop: (item: Item) => void;
  /** Search Google Lens for near-identical products straight away (worn items from mirror selfies). */
  autoFindOnline?: boolean;
}) {
  const [draft, setDraft] = useState<Draft>(item);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [more, setMore] = useState(false);

  // Keep image/cutout fields in sync when the parent updates them (e.g. after a cutout).
  const view = { ...draft, cutout_url: item.cutout_url, cutout_method: item.cutout_method, crop_url: item.crop_url };

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => {
      const next = { ...d, [key]: value };
      // Changing category resets subcategory to the first valid one.
      if (key === "category") {
        const subs = SUBCATEGORIES_BY_CATEGORY[value as Category] as readonly string[];
        if (!subs.includes(next.subcategory ?? "")) next.subcategory = subs[0];
      }
      return next;
    });
    setDirty(true);
  };
  const toggle = (key: (typeof CHIP_FIELDS)[number]["key"], v: string) =>
    set(key, draft[key].includes(v) ? draft[key].filter((x) => x !== v) : [...draft[key], v]);

  async function save() {
    setSaving(true);
    const body = Object.fromEntries(EDITABLE_KEYS.map((k) => [k, draft[k]]));
    const res = await fetch(`/api/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) return toast.error("Couldn't save");
    const updated = (await res.json()) as Item;
    setDraft(updated);
    setDirty(false);
    onChange(updated);
    toast.success("Saved");
  }

  async function remove() {
    if (!confirm("Delete this item? Use this for wrong detections.")) return;
    const res = await fetch(`/api/items/${item.id}`, { method: "DELETE" });
    if (!res.ok) return toast.error("Couldn't delete");
    onDeleted(item.id);
    toast("Item deleted");
  }

  const subs = SUBCATEGORIES_BY_CATEGORY[draft.category as Category] ?? [];
  const busy = !!cutoutStatus;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
      <div className="relative">
        <ItemImage item={view} tile="checker" sizes="(max-width: 768px) 100vw, 33vw" />
        <CutoutBadge method={item.cutout_method} className="absolute left-2 top-2" />
        {draft.confidence !== null && draft.confidence < 0.6 && (
          <span className="absolute right-2 top-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">Check me</span>
        )}
        {busy && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-white/75 text-sm">
            <Loader2 className="size-5 animate-spin text-primary" />
            {cutoutStatus}
          </div>
        )}
      </div>

      <p className="text-sm leading-snug">{draft.description}</p>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Category">
          <Select value={draft.category} values={CATEGORIES} onChange={(v) => set("category", v)} />
        </Field>
        <Field label="Type">
          <Select value={draft.subcategory} values={subs} onChange={(v) => set("subcategory", v)} />
        </Field>
        <Field label="Colour">
          <div className="flex items-center gap-2">
            <span
              className="size-5 shrink-0 rounded-full border"
              style={{ background: COLOR_SWATCH[draft.primary_color as keyof typeof COLOR_SWATCH] ?? draft.primary_color_hex ?? "#ccc" }}
            />
            <div className="flex-1">
              <Select value={draft.primary_color} values={COLORS} onChange={(v) => set("primary_color", v)} />
            </div>
          </div>
        </Field>
        <Field label="Size">
          <Input value={draft.size ?? ""} onChange={(e) => set("size", e.target.value || null)} placeholder="e.g. M, 28" className="h-9 text-sm" />
        </Field>
        {MAIN_FIELDS.map((f) => (
          <Field key={f.key} label={f.label}>
            <Select value={draft[f.key] as string | null} values={f.values} onChange={(v) => set(f.key, v as never)} />
          </Field>
        ))}
      </div>

      <button type="button" onClick={() => setMore((m) => !m)} className="flex items-center gap-1 self-start text-xs font-medium text-primary">
        <ChevronDown className={cn("size-4 transition-transform", more && "rotate-180")} /> {more ? "Fewer details" : "More details"}
      </button>

      {more && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {MORE_FIELDS.map((f) => (
              <Field key={f.key} label={f.label}>
                <Select value={draft[f.key] as string | null} values={f.values} onChange={(v) => set(f.key, v as never)} />
              </Field>
            ))}
            <Field label="Formality">
              <Select
                value={String(draft.formality ?? 2)}
                values={["1", "2", "3", "4", "5"]}
                onChange={(v) => set("formality", Number(v))}
              />
            </Field>
            <Field label="Brand">
              <Input value={draft.brand_visible ?? ""} onChange={(e) => set("brand_visible", e.target.value || null)} className="h-9 text-sm" />
            </Field>
          </div>
          {CHIP_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{f.label}</span>
              <div className="flex flex-wrap gap-1.5">
                {f.values.map((v) => {
                  const on = draft[f.key].includes(v);
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => toggle(f.key, v)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs",
                        on ? "border-primary bg-primary text-primary-foreground" : "bg-white hover:bg-accent"
                      )}
                    >
                      {labelize(v)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <Field label="Description">
            <Textarea value={draft.description ?? ""} onChange={(e) => set("description", e.target.value)} className="min-h-16 text-sm" />
          </Field>
        </div>
      )}

      <SimilarOnline item={{ ...draft, ...item }} auto={autoFindOnline} onChange={onChange} />

      <div className="grid grid-cols-2 gap-2 pt-1">
        <Button size="sm" onClick={save} disabled={!dirty || saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />} {dirty ? "Save" : "Saved"}
        </Button>
        <Button size="sm" variant="outline" onClick={remove} className="text-destructive">
          <Trash2 /> Delete
        </Button>
        <Button size="sm" variant="outline" onClick={() => onRedoCutout(item)} disabled={busy}>
          <Wand2 /> {item.cutout_method === "browser_bg_removal" ? "Redo cutout" : "Real cutout"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => onUseCrop(item)} disabled={busy || item.cutout_method === "crop_only"}>
          <Crop /> Use crop
        </Button>
      </div>
    </div>
  );
}
