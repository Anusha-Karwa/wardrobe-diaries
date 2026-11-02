"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ItemImage } from "@/components/item-image";
import {
  EMPTY_FILTERS,
  FILTER_GROUPS,
  activeCount,
  applyFilters,
  facetCounts,
  filtersFromParams,
  filtersToParams,
  type FilterKey,
  type Filters,
} from "@/lib/filters";
import { COLOR_SWATCH } from "@/lib/taxonomy";
import type { Item } from "@/lib/types";
import { cn, labelize } from "@/lib/utils";

type Sort = "newest" | "category" | "colour";
const OPEN_BY_DEFAULT = new Set<FilterKey>(["category", "subcategory", "primary_color", "pattern"]);
const COLOUR_ORDER = Object.keys(COLOR_SWATCH);

export function WardrobeClient({ items }: { items: Item[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => filtersFromParams(new URLSearchParams(params.toString())));
  const [sort, setSort] = useState<Sort>("newest");

  // Keep the URL in sync so a filtered view can be shared/linked (e.g. from the stylist).
  useEffect(() => {
    const qs = filtersToParams(filters).toString();
    if (qs !== params.toString()) router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const visible = useMemo(() => {
    const list = applyFilters(items, filters);
    if (sort === "category") return [...list].sort((a, b) => a.category.localeCompare(b.category) || String(a.subcategory).localeCompare(String(b.subcategory)));
    if (sort === "colour") return [...list].sort((a, b) => COLOUR_ORDER.indexOf(a.primary_color ?? "") - COLOUR_ORDER.indexOf(b.primary_color ?? ""));
    return list;
  }, [items, filters, sort]);
  const facets = useMemo(() => facetCounts(items, filters), [items, filters]);
  const nActive = activeCount(filters);

  const toggle = (key: FilterKey, value: string) =>
    setFilters((f) => {
      const cur = f.selected[key] ?? [];
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      const selected = { ...f.selected, [key]: next };
      // Dropping a category also drops subcategories that belong only to it.
      if (key === "category" && selected.subcategory?.length) {
        const cats = next;
        selected.subcategory = cats.length
          ? selected.subcategory.filter((s) => items.some((i) => i.subcategory === s && cats.includes(i.category)))
          : selected.subcategory;
      }
      return { ...f, selected };
    });
  const clearAll = () => setFilters(EMPTY_FILTERS);

  if (!items.length) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-3xl font-semibold">Your closet is empty</h1>
        <p className="mx-auto mt-2 max-w-sm text-muted-foreground">Upload a few photos: flat lays, hanger shots or a mirror selfie. Closet will cut out and tag every piece.</p>
        <Button asChild className="mt-6">
          <Link href="/upload">
            <Plus /> Add clothes
          </Link>
        </Button>
      </div>
    );
  }

  const panel = (
    <FilterPanel facets={facets} filters={filters} toggle={toggle} setFormality={(r) => setFilters((f) => ({ ...f, formality: r }))} />
  );

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Wardrobe</h1>
          <p className="text-sm text-muted-foreground">
            {visible.length === items.length ? `${items.length} pieces` : `${visible.length} of ${items.length} pieces`}
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/upload">
            <Plus /> Add
          </Link>
        </Button>
      </div>

      {/* Search + mobile filter button + sort */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            placeholder="Search: red block print, denim, party…"
            className="pl-9"
            aria-label="Search wardrobe"
          />
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="md:hidden" aria-label="Filters">
              <SlidersHorizontal />
              {nActive > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">{nActive}</span>}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom">
            <div className="flex items-center justify-between border-b px-5 pb-3 pt-5 pr-14">
              <SheetTitle>Filters</SheetTitle>
              {nActive > 0 && (
                <button onClick={clearAll} className="text-sm font-medium text-primary">
                  Clear all
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3">{panel}</div>
            <div className="border-t p-4">
              <SheetTrigger asChild>
                <Button className="w-full">Show {visible.length} pieces</Button>
              </SheetTrigger>
            </div>
          </SheetContent>
        </Sheet>
        <div className="w-32 shrink-0">
          <NativeSelect value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
            <option value="newest">Newest</option>
            <option value="category">Category</option>
            <option value="colour">Colour</option>
          </NativeSelect>
        </div>
      </div>

      {/* Active filter chips */}
      {nActive > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {Object.entries(filters.selected).flatMap(([key, vals]) =>
            (vals ?? []).map((v) => (
              <button
                key={`${key}:${v}`}
                onClick={() => toggle(key as FilterKey, v)}
                className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground"
              >
                {labelize(v)} <X className="size-3" />
              </button>
            ))
          )}
          {(filters.formality[0] > 1 || filters.formality[1] < 5) && (
            <button
              onClick={() => setFilters((f) => ({ ...f, formality: [1, 5] }))}
              className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground"
            >
              Formality {filters.formality[0]}–{filters.formality[1]} <X className="size-3" />
            </button>
          )}
          <button onClick={clearAll} className="px-1 text-xs font-medium text-primary">
            Clear all
          </button>
        </div>
      )}

      <div className="flex gap-6">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 md:block">
          <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto pr-2">{panel}</div>
        </aside>

        <div className="min-w-0 flex-1">
          {visible.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {visible.map((item, i) => (
                <Link key={item.id} href={`/item/${item.id}`} className="group">
                  <ItemImage item={item} priority={i < 6} className="transition-transform group-hover:scale-[1.02]" />
                  <div className="mt-1.5 flex items-start gap-1.5">
                    <span
                      className="mt-1 size-2.5 shrink-0 rounded-full border border-black/10"
                      style={{ background: COLOR_SWATCH[item.primary_color as keyof typeof COLOR_SWATCH] ?? item.primary_color_hex ?? "#ccc" }}
                    />
                    <p className="line-clamp-2 text-xs leading-snug text-foreground/80">{item.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed p-10 text-center">
              <p className="font-medium">Nothing matches these filters</p>
              <p className="mt-1 text-sm text-muted-foreground">Try removing one, or ask the stylist what to buy.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={clearAll}>
                Clear all filters
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterPanel({
  facets,
  filters,
  toggle,
  setFormality,
}: {
  facets: ReturnType<typeof facetCounts>;
  filters: Filters;
  toggle: (key: FilterKey, value: string) => void;
  setFormality: (r: [number, number]) => void;
}) {
  // Every group, Formality included, in alphabetical order.
  type Group = { label: string; node: React.ReactNode };
  const groups: Group[] = FILTER_GROUPS.map(({ key, label }): Group | null => {
    const values = facets[key];
    if (!values?.length) return null;
    const selected = filters.selected[key] ?? [];
    return {
      label,
      node: (
        <FilterGroup key={key} label={label} count={selected.length} defaultOpen={OPEN_BY_DEFAULT.has(key) || selected.length > 0}>
          <ChipList values={values} isColour={key === "primary_color"} selected={selected} onToggle={(v) => toggle(key, v)} />
        </FilterGroup>
      ),
    };
  }).filter((g): g is Group => !!g);
  groups.push({ label: "Formality", node: <FormalityGroup key="formality" filters={filters} setFormality={setFormality} /> });
  groups.sort((a, b) => a.label.localeCompare(b.label));

  return <div className="divide-y divide-dashed divide-lace">{groups.map((g) => g.node)}</div>;
}

function FormalityGroup({ filters, setFormality }: { filters: Filters; setFormality: (r: [number, number]) => void }) {
  return (
      <FilterGroup label="Formality" count={filters.formality[0] > 1 || filters.formality[1] < 5 ? 1 : 0} defaultOpen={false}>
        <div className="flex items-center gap-2 text-sm">
          <NativeSelect
            value={filters.formality[0]}
            onChange={(e) => setFormality([Math.min(Number(e.target.value), filters.formality[1]), filters.formality[1]])}
            className="h-9"
            aria-label="Minimum formality"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </NativeSelect>
          to
          <NativeSelect
            value={filters.formality[1]}
            onChange={(e) => setFormality([filters.formality[0], Math.max(Number(e.target.value), filters.formality[0])])}
            className="h-9"
            aria-label="Maximum formality"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </NativeSelect>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">1 = very casual, 5 = very formal</p>
      </FilterGroup>
  );
}

function FilterGroup({ label, count, defaultOpen, children }: { label: string; count: number; defaultOpen: boolean; children: React.ReactNode }) {
  return (
    <details open={defaultOpen} className="group py-3 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
        <span>
          {label}
          {count > 0 && <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[11px] font-medium text-primary-foreground">{count}</span>}
        </span>
        <span className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="mt-2.5">{children}</div>
    </details>
  );
}

function ChipList({
  values,
  selected,
  onToggle,
  isColour,
}: {
  values: { value: string; count: number }[];
  selected: string[];
  onToggle: (v: string) => void;
  isColour?: boolean;
}) {
  const [all, setAll] = useState(false);
  // More than 5 options: show 5, the rest behind "Show more".
  const shown = all ? values : values.slice(0, 5);
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map(({ value, count }) => {
        const on = selected.includes(value);
        return (
          <button
            key={value}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(value)}
            disabled={!on && count === 0}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-40",
              on ? "border-primary bg-primary text-primary-foreground" : "bg-white hover:bg-accent"
            )}
          >
            {isColour && (
              <span
                className="size-3 rounded-full border border-black/10"
                style={{ background: COLOR_SWATCH[value as keyof typeof COLOR_SWATCH] ?? "#ccc" }}
              />
            )}
            {labelize(value)}
            <span className={cn("tabular-nums", on ? "text-primary-foreground/80" : "text-muted-foreground")}>{count}</span>
          </button>
        );
      })}
      {values.length > 5 && (
        <button type="button" onClick={() => setAll((a) => !a)} className="px-1 text-xs font-bold text-primary">
          {all ? "Show less" : `Show more (${values.length - 5})`}
        </button>
      )}
    </div>
  );
}
