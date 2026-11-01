/**
 * npm run db:setup — creates every table in db/schema.sql (safe to run many times).
 * Reads DATABASE_URL from .env.local (or the shell environment).
 */
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });
config();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("✗ DATABASE_URL is not set. Add it to .env.local (see README / .env.example).");
    process.exit(1);
  }
  const sql = neon(url);
  const file = readFileSync(join(process.cwd(), "db", "schema.sql"), "utf8");

  // Strip "--" comments, then split into statements on semicolons at the end of a line.
  const statements = file
    .split("\n")
    .map((l) => l.replace(/--.*$/, ""))
    .join("\n")
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    const preview = stmt.replace(/\s+/g, " ").slice(0, 70);
    await sql.query(stmt);
    console.log("✓", preview);
  }

  const tables = await sql.query(
    "select table_name from information_schema.tables where table_schema = 'public' order by table_name"
  );
  console.log("\nTables:", tables.map((t: Record<string, unknown>) => t.table_name).join(", "));
  console.log("Database is ready.");
}

main().catch((err) => {
  console.error("✗ db:setup failed:", err.message ?? err);
  process.exit(1);
});
