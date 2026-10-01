import { NextResponse } from "next/server";
import { setShortlistSize } from "@/lib/data";
import { requireSession } from "@/lib/guard";

export async function POST(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  const { shortlist_size } = (await req.json()) as { shortlist_size?: number };
  const n = Number(shortlist_size);
  if (!Number.isInteger(n) || n < 1 || n > 100) return NextResponse.json({ error: "shortlist_size must be an integer 1–100" }, { status: 400 });
  await setShortlistSize(n);
  return NextResponse.json({ ok: true });
}
