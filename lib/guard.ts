import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authEnabled, isValidSession, SESSION_COOKIE } from "./auth";

/** Defence in depth: every route handler re-checks the session (proxy.ts is the first gate). */
export async function requireSession(): Promise<NextResponse | null> {
  if (!authEnabled()) return null;
  const ok = await isValidSession((await cookies()).get(SESSION_COOKIE)?.value);
  return ok ? null : NextResponse.json({ error: "Not signed in" }, { status: 401 });
}

export function jsonError(e: unknown, status = 500) {
  return NextResponse.json({ error: (e as Error)?.message ?? String(e) }, { status });
}
