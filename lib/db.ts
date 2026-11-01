import { neon } from "@neondatabase/serverless";

/** Neon tagged-template SQL client. Usage: await sql`select * from items where id = ${id}` */
export const sql = neon(process.env.DATABASE_URL!);
