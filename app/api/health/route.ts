import { NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { rubricHealth } from "@/lib/rubric";

export async function GET() {
  const denied = await requireSession();
  if (denied) return denied;
  const h = await rubricHealth();
  return NextResponse.json({ ok: h.ok, errors: h.errors, criteria: h.criteria.length }, { status: h.ok ? 200 : 500 });
}
