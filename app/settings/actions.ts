"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { saveProfile } from "@/lib/queries";
import { AESTHETICS, GENDER_PREFS } from "@/lib/taxonomy";

const ProfileSchema = z.object({
  name: z.string().trim().max(80).nullable(),
  gender_pref: z.enum(GENDER_PREFS),
  city: z.string().trim().min(1).max(80),
  budget_band: z.enum(["budget", "mid", "premium"]),
  aesthetics: z.array(z.enum(AESTHETICS)).max(15),
  notes: z.string().trim().max(1000).nullable(),
});

export async function saveProfileAction(input: unknown) {
  const parsed = ProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Please check the form: " + parsed.error.issues[0]?.message };
  try {
    await saveProfile({
      ...parsed.data,
      name: parsed.data.name || null,
      notes: parsed.data.notes || null,
    });
    revalidatePath("/", "layout");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}
