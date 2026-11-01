/** Passcode auth shared by middleware (edge) and the login route (node). Uses Web Crypto only. */
export const AUTH_COOKIE = "closet_auth";
export const AUTH_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/** The cookie value is a hash of the passcode, so the passcode itself never sits in the browser. */
export async function authToken(passcode: string) {
  const data = new TextEncoder().encode(`closet:v1:${passcode}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time-ish string comparison. */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
