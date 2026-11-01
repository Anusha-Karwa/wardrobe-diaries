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
| `APP_PASSCODE` | Anything you like, e.g. `closet2026` |
| `CRON_SECRET` | `openssl rand -hex 32` |

If the project is linked to Vercel, `vercel link` then `vercel env pull .env.local` fills in the storage values for you.

Check wiring at `/api/health` (after logging in).
