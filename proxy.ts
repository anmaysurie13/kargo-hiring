import { NextResponse, type NextRequest } from "next/server";
import { authEnabled, isValidSession, SESSION_COOKIE } from "./lib/auth";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!authEnabled()) return pathname === "/login" ? NextResponse.redirect(new URL("/", req.url)) : NextResponse.next();
  if (pathname === "/login" || pathname === "/api/login") return NextResponse.next();
  if (await isValidSession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const url = new URL("/login", req.url);
  url.searchParams.set("next", pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|ico)$).*)"],
};
