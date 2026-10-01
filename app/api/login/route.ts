import { NextResponse } from "next/server";
import { safeEqual, SESSION_COOKIE, sessionToken } from "@/lib/auth";

export async function POST(req: Request) {
  const pw = process.env.DASHBOARD_PASSWORD;
  if (!pw) return NextResponse.json({ error: "DASHBOARD_PASSWORD is not set" }, { status: 500 });
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (!password || !safeEqual(password, pw)) {
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await sessionToken(pw), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return res;
}
