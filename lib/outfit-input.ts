import { z } from "zod";

/** Shape the client sends when saving or rendering an outfit. */
export const OutfitInput = z.object({
  name: z.string().trim().min(1).max(120),
  style_tag: z.string().trim().max(60).default(""),
  occasion: z.string().trim().max(60).nullable().optional(),
  reasoning: z.string().trim().max(1000).default(""),
  missing_piece: z.string().trim().max(300).nullable().optional(),
  color_story: z.string().trim().max(200).default(""),
  item_ids: z.array(z.string().uuid()).min(1).max(10),
  source: z.enum(["anchor", "occasion", "agent", "daily"]).default("occasion"),
});
export type OutfitInput = z.infer<typeof OutfitInput>;
