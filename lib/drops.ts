import { z } from "zod";
import { putBlob } from "./blob";
import { renderBoard } from "./board";
import { sql } from "./db";
import { generateJson } from "./gemini";
import { generateOutfits, type GeneratedOutfit } from "./outfits";
import { getItemsByIds, getOutfit, getProfile, insertOutfit, listItems, setOutfitBoard } from "./queries";
import { toBuyCard } from "./shopping";
import { CATEGORY_GROUPS, getCurrentTrends, matchCurrentTrends, refreshAll, type GroupKey, type TrendWithMatch } from "./trends";
import type { BuyCard, Item, Outfit } from "./types";

/**
 * Daily & weekly drops (spec 6k).
 * daily  = outfit of the day (weekday-aware, prefers rarely-suggested items) + one trending item you're missing
 * weekly = headline + top 5 trends + "your 3 smart buys" (pairable items × heat) + "already in your closet"
 */

// ---------------------------------------------------------------------------
// Dates (India time)
// ---------------------------------------------------------------------------
export function todayIST(d = new Date()) {
  return new Date(d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}
export const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** Monday of the week containing d. */
export function mondayOf(d: Date) {
  const m = new Date(d);
  m.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return m;
}

const WEEKDAY_PLAN: { occasion: string; vibe: string; label: string }[] = [
  { occasion: "casual", vibe: "relaxed Sunday, brunch or errands", label: "Sunday reset" },
  { occasion: "work", vibe: "polished but easy Monday", label: "Monday, sorted" },
  { occasion: "work", vibe: "sharp and confident", label: "Tuesday power look" },
  { occasion: "college", vibe: "midweek, comfortable and put-together", label: "Midweek mood" },
  { occasion: "work", vibe: "office to evening plans", label: "Thursday desk-to-dinner" },
  { occasion: "casual", vibe: "casual Friday, a little playful", label: "Casual Friday" },
  { occasion: "date", vibe: "weekend plans, brunch or a date", label: "Saturday plans" },
];

/** Which 3 trend groups the daily cron refreshes (rotates so all 7 refresh every few days). */
export function groupsForDay(d: Date): GroupKey[] {
  const dayOfYear = Math.floor((+d - +new Date(d.getFullYear(), 0, 0)) / 86_400_000);
  const start = (dayOfYear * 3) % CATEGORY_GROUPS.length;
  return [0, 1, 2].map((i) => CATEGORY_GROUPS[(start + i) % CATEGORY_GROUPS.length].key);
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
export interface DailyPayload {
  headline: string;
  intro: string;
  occasion: string;
  trending_missing: (BuyCard & { note: string | null; summary: string | null }) | null;
}
export interface WeeklyPayload {
  headline: string;
  intro: string;
  top_trend_ids: string[];
  smart_buys: (BuyCard & { score: number; note: string | null })[];
  in_your_closet: { trend_id: string; title: string; item_ids: string[]; tip: string | null }[];
}
export interface Drop<P> {
  id: string;
  period: "daily" | "weekly";
  for_date: string;
  outfit_id: string | null;
  payload: P;
  created_at: string;
}

export async function getDrop<P>(period: "daily" | "weekly", forDate: string) {
  const rows = await sql`select id, period, to_char(for_date, 'YYYY-MM-DD') as for_date, outfit_id, payload, created_at from drops where period = ${period} and for_date = ${forDate}`;
  return (rows[0] as Drop<P> | undefined) ?? null;
}

async function upsertDrop(period: "daily" | "weekly", forDate: string, outfitId: string | null, payload: unknown) {
  await sql`
    insert into drops (period, for_date, outfit_id, payload) values (${period}, ${forDate}, ${outfitId}, ${JSON.stringify(payload)}::jsonb)
    on conflict (period, for_date) do update set outfit_id = excluded.outfit_id, payload = excluded.payload, created_at = now()`;
}

/** Missing trends ranked by "how many of your clothes it unlocks × heat". */
function rankMissing(trends: TrendWithMatch[]) {
  return trends
    .filter((t) => t.status === "missing")
    .map((t) => ({ t, score: Math.max(1, t.pairs_with_item_ids.length) * (t.heat ?? 3) }))
    .sort((a, b) => b.score - a.score);
}

function trendBuyCard(t: TrendWithMatch, genderPref: string, budget: string) {
  const attrs = Object.fromEntries(Object.entries(t.match_attributes ?? {}).map(([k, v]) => [k, v[0]]));
  return toBuyCard(
    { title: t.title, category: t.category ?? "accessory", attributes: attrs, why: t.note ?? t.summary ?? "", pairs_with_item_ids: t.pairs_with_item_ids },
    { genderPref, budgetBand: budget, trendHint: t }
  );
}

// ---------------------------------------------------------------------------
// Daily
// ---------------------------------------------------------------------------
async function saveOutfitWithBoard(o: GeneratedOutfit, source: "daily") {
  const saved = await insertOutfit({ ...o, source });
  try {
    const png = await renderBoard(o);
    const url = await putBlob(`boards/${saved.id}.png`, png, "image/png");
    await setOutfitBoard(saved.id, url);
    saved.board_url = url;
  } catch (err) {
    console.warn("[drops] board render failed", (err as Error).message);
  }
  return saved;
}

export async function createDailyDrop(date = todayIST()) {
  const forDate = isoDate(date);
  const plan = WEEKDAY_PLAN[date.getDay()];
  const [profile, trends, items] = await Promise.all([getProfile(), getCurrentTrends(), listItems()]);

  let outfit: Outfit | null = null;
  if (items.length) {
    const r = await generateOutfits({ mode: "occasion", occasion: plan.occasion, vibe: plan.vibe, count: 1, preferForgotten: true });
    if (r.outfits[0]) outfit = await saveOutfitWithBoard(r.outfits[0], "daily");
  }

  const top = rankMissing(trends)[0]?.t;
  const payload: DailyPayload = {
    headline: plan.label,
    intro: outfit ? (outfit.reasoning ?? "") : "Upload a few pieces and your outfit of the day appears here.",
    occasion: plan.occasion,
    trending_missing: top ? { ...trendBuyCard(top, profile.gender_pref, profile.budget_band), note: top.note, summary: top.summary } : null,
  };
  await upsertDrop("daily", forDate, outfit?.id ?? null, payload);
  return getDrop<DailyPayload>("daily", forDate);
}

// ---------------------------------------------------------------------------
// Weekly
// ---------------------------------------------------------------------------
const Headline = z.object({ headline: z.string(), intro: z.string() });

export async function createWeeklyDrop(date = todayIST()) {
  const forDate = isoDate(mondayOf(date));
  const [profile, trends] = await Promise.all([getProfile(), getCurrentTrends()]);
  const top = [...trends].sort((a, b) => (b.heat ?? 0) - (a.heat ?? 0)).slice(0, 5);
  const smart = rankMissing(trends)
    .slice(0, 3)
    .map(({ t, score }) => ({ ...trendBuyCard(t, profile.gender_pref, profile.budget_band), score, note: t.note }));
  const closet = trends
    .filter((t) => t.status === "owned")
    .slice(0, 4)
    .map((t) => ({ trend_id: t.id, title: t.title, item_ids: t.owned_item_ids, tip: t.note ?? t.how_to_style }));

  let headline = top[0] ? `${top[0].title} lead the week` : "This week in fashion";
  let intro = "";
  if (top.length) {
    try {
      const h = await generateJson(
        Headline,
        {
          contents: `Write a magazine-style headline (max 7 words, e.g. "Sheer is the story this week") and a 2-sentence intro for this week's personal fashion drop.
Top trends: ${top.map((t) => t.title).join("; ")}.
Smart buys for this user: ${smart.map((s) => s.title).join("; ") || "none"}.
Already in their closet: ${closet.map((c) => c.title).join("; ") || "none"}.
Warm, sharp, specific. Return JSON {"headline","intro"}.`,
          config: { temperature: 0.8 },
        },
        { label: "drops:headline", timeoutMs: 30_000, thinkingLevel: "LOW" }
      );
      headline = h.headline.trim();
      intro = h.intro.trim();
    } catch (err) {
      console.warn("[drops] headline failed, using fallback", (err as Error).message);
    }
  }
  const payload: WeeklyPayload = { headline, intro, top_trend_ids: top.map((t) => t.id), smart_buys: smart, in_your_closet: closet };
  await upsertDrop("weekly", forDate, null, payload);
  return getDrop<WeeklyPayload>("weekly", forDate);
}

// ---------------------------------------------------------------------------
// Cron jobs
// ---------------------------------------------------------------------------
export async function runDailyCron(date = todayIST()) {
  const started = Date.now();
  // Trends refresh weekly (Monday); every day we only re-match them to the wardrobe and make today's drop.
  await matchCurrentTrends().catch((e) => console.warn("[cron] match failed", e.message));
  const drop = await createDailyDrop(date);
  return { drop: drop?.for_date, outfit: !!drop?.outfit_id, ms: Date.now() - started };
}

export async function runWeeklyCron(date = todayIST()) {
  const started = Date.now();
  const r = await refreshAll(undefined, "weekly", 4);
  const drop = await createWeeklyDrop(date);
  return { groups: r.results.length, trends: r.matched, owned: r.owned, drop: drop?.for_date, ms: Date.now() - started };
}

// ---------------------------------------------------------------------------
// Home page data
// ---------------------------------------------------------------------------
export async function dailyDropWithOutfit(forDate: string) {
  const drop = await getDrop<DailyPayload>("daily", forDate);
  if (!drop) return null;
  let outfit: (Outfit & { items: Item[] }) | null = null;
  if (drop.outfit_id) {
    const o = await getOutfit(drop.outfit_id);
    if (o) {
      const its = await getItemsByIds(o.item_ids);
      outfit = { ...o, items: o.item_ids.map((id) => its.find((i) => i.id === id)).filter((i): i is Item => !!i) };
    }
  }
  return { ...drop, outfit };
}
