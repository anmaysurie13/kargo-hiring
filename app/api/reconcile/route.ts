import { NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { pendingTasks, reconcile } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 60;

/** STEP 3: how many briefs/drafts are pending. */
export async function GET() {
  const denied = await requireSession();
  if (denied) return denied;
  const { tasks } = await pendingTasks();
  return NextResponse.json({ pending: tasks.length });
}

/** STEP 3: generate pending briefs/drafts within a time budget. Never sends anything. */
export async function POST() {
  const denied = await requireSession();
  if (denied) return denied;
  try {
    return NextResponse.json(await reconcile(40_000));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
