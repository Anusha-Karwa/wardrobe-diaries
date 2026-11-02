import { safeEqual } from "./auth";

/** Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` automatically when CRON_SECRET is set. */
export function isCronAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  return safeEqual(header, `Bearer ${secret}`);
}
