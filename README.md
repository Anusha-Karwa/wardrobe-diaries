# Closet: AI wardrobe stylist + trend agent

Next.js (App Router) · Gemini (`@google/genai`) · Neon Postgres · Vercel Blob · Vercel Cron.

> The full README (architecture diagram, demo script, limitations) is written in the final phase.

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in the values (see below)
npm run db:setup             # creates all tables (safe to re-run)
npm run dev                  # http://localhost:3000
```

| Variable | Where to get it |
|---|---|
| `GEMINI_API_KEY` | aistudio.google.com → Get API key |
| `GEMINI_MODEL` | Optional. Blank = `gemini-flash-latest` alias. Pin a version from the Gemini models page if you prefer. |
| `DATABASE_URL` | Neon pooled connection string (Vercel → Storage → Neon, or neon.tech → Connect → "Pooled connection") |
| `BLOB_READ_WRITE_TOKEN` | Vercel → Storage → Blob store → `.env.local` tab |
| `REQUIRE_PASSCODE` / `APP_PASSCODE` | Optional lock. The app is open unless `REQUIRE_PASSCODE=true`; then it asks for `APP_PASSCODE`. |
| `CRON_SECRET` | `openssl rand -hex 32` |

If the project is linked to Vercel, `vercel link` then `vercel env pull .env.local` fills in the storage values for you.

Optional: `GEMINI_IMAGE_MODEL` (default `gemini-3.1-flash-image`) and `GEMINI_SEGMENTATION` (default `off`).

Check wiring at `/api/health` (after logging in).

## How the extraction pipeline cuts items out

| Photo | Cutout | Badge |
|---|---|---|
| Single item / flat lay / hanger | Background removed **in the browser** from your real photo (`@imgly/background-removal`) | Real cutout |
| Worn (mirror selfie) | Gemini's image model re-draws each item as a product shot on a key colour, which sharp removes | AI product shot |
| Tiny worn items (e.g. a necklace in a full-body shot) | Rectangle crop | Crop |

Gemini segmentation masks (the spec's original Stage 3) are implemented in `lib/extraction/segment.ts` but **off by default**: on current Gemini 3 Flash models they took ~50 s per item and came back empty, and `gemini-2.5-flash` is no longer offered to new API keys. Every card has **Real cutout** and **Use crop** buttons, so an AI product shot can always be swapped for your real photo.

`seed-images/` holds three AI-generated test photos (a mirror selfie and two flat lays) used to test the pipeline.
