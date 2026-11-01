import { Sparkles, Scissors, Crop, Wand2 } from "lucide-react";
import type { CutoutMethod } from "@/lib/types";
import { cn } from "@/lib/utils";

const META: Record<CutoutMethod, { label: string; icon: typeof Sparkles; className: string; title: string }> = {
  gemini_mask: { label: "Gemini mask", icon: Scissors, className: "bg-emerald-100 text-emerald-800", title: "Cut out of your photo with a Gemini segmentation mask" },
  ai_product_shot: { label: "AI product shot", icon: Sparkles, className: "bg-violet-100 text-violet-800", title: "Re-drawn by Gemini as a product shot from your photo. Details may differ slightly; you can switch to the real crop." },
  browser_bg_removal: { label: "Real cutout", icon: Wand2, className: "bg-sky-100 text-sky-800", title: "Background removed from your real photo (in your browser)" },
  crop_only: { label: "Crop", icon: Crop, className: "bg-stone-200 text-stone-700", title: "Rectangle crop of your photo" },
};

export function CutoutBadge({ method, className }: { method: CutoutMethod | null; className?: string }) {
  if (!method) return <span className={cn("rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800", className)}>Cutting out…</span>;
  const m = META[method];
  return (
    <span title={m.title} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", m.className, className)}>
      <m.icon className="size-3" /> {m.label}
    </span>
  );
}
