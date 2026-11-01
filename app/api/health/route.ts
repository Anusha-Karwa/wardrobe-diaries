import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { GEMINI_MODEL } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Quick check that the env vars are wired up. Visit /api/health while logged in. */
export async function GET() {
  const env = {
    GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
    GEMINI_MODEL,
    DATABASE_URL: !!process.env.DATABASE_URL,
    BLOB_READ_WRITE_TOKEN: !!process.env.BLOB_READ_WRITE_TOKEN,
    APP_PASSCODE: !!process.env.APP_PASSCODE,
    CRON_SECRET: !!process.env.CRON_SECRET,
  };
  let database: string;
  try {
    const rows = await sql`select count(*)::int as n from information_schema.tables where table_schema = 'public'`;
    database = `ok (${rows[0].n} tables)`;
  } catch (err) {
    database = `error: ${(err as Error).message}`;
  }
  return NextResponse.json({ env, database });
}
