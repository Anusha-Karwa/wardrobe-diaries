import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "crop_top" -> "Crop top" */
export function labelize(v: string | null | undefined) {
  if (!v) return "";
  const s = v.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Drop repeated product links (Google Lens often lists the same product twice). Used by server and client alike. */
export function dedupeMatches<T extends { link: string }>(list: T[] | null | undefined): T[] {
  const seen = new Set<string>();
  return (list ?? []).filter((m) => {
    const k = m.link.split("?")[0];
    return seen.has(k) ? false : (seen.add(k), true);
  });
}
