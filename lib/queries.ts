import { sql } from "./db";

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------
export interface Profile {
  name: string | null;
  gender_pref: string;
  city: string;
  budget_band: string;
  aesthetics: string[];
  notes: string | null;
  updated_at?: string;
}

const DEFAULT_PROFILE: Profile = {
  name: null,
  gender_pref: "women",
  city: "Bengaluru",
  budget_band: "mid",
  aesthetics: [],
  notes: null,
};

export async function getProfile(): Promise<Profile> {
  const rows = await sql`select name, gender_pref, city, budget_band, aesthetics, notes, updated_at from profile where id = 1`;
  return rows[0] ? { ...DEFAULT_PROFILE, ...(rows[0] as Profile) } : DEFAULT_PROFILE;
}

export async function saveProfile(p: Profile) {
  await sql`
    insert into profile (id, name, gender_pref, city, budget_band, aesthetics, notes, updated_at)
    values (1, ${p.name}, ${p.gender_pref}, ${p.city}, ${p.budget_band}, ${p.aesthetics}, ${p.notes}, now())
    on conflict (id) do update set
      name = excluded.name,
      gender_pref = excluded.gender_pref,
      city = excluded.city,
      budget_band = excluded.budget_band,
      aesthetics = excluded.aesthetics,
      notes = excluded.notes,
      updated_at = now()`;
}
