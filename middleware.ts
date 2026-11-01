import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, authToken, safeEqual } from "@/lib/auth";

// When the passcode is on, everything is protected except /login, /api/login and /api/cron/* (those use CRON_SECRET).
const PUBLIC_PATHS = ["/login", "/api/login"];

// The passcode is OFF by default. Set REQUIRE_PASSCODE=true (plus APP_PASSCODE) to turn it back on.
const PASSCODE_ON = process.env.REQUIRE_PASSCODE === "true";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!PASSCODE_ON) {
    // No passcode: send anyone who lands on /login straight to the app.
    if (pathname === "/login") return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }
  if (PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/api/cron/")) return NextResponse.next();

  const passcode = process.env.APP_PASSCODE;
  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  if (passcode && cookie && safeEqual(cookie, await authToken(passcode))) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip Next internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|wasm|onnx)$).*)"],
};
