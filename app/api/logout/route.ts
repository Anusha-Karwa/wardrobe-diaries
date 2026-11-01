import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";

export async function GET(req: Request) {
  const res = NextResponse.redirect(new URL("/login", req.url));
  res.cookies.delete(AUTH_COOKIE);
  return res;
}
