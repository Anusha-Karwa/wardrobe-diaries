import { NextResponse } from "next/server";
import { AUTH_COOKIE, AUTH_MAX_AGE, authToken, safeEqual } from "@/lib/auth";

export async function POST(req: Request) {
  const passcode = process.env.APP_PASSCODE;
  if (!passcode) {
    return NextResponse.json({ error: "APP_PASSCODE is not set on the server." }, { status: 500 });
  }
  const body = await req.json().catch(() => ({}));
  const given = String(body?.passcode ?? "");
  if (!safeEqual(given, passcode)) {
    await new Promise((r) => setTimeout(r, 400)); // slow down guessing a little
    return NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, await authToken(passcode), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_MAX_AGE,
  });
  return res;
}
