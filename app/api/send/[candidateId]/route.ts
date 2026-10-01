import { NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { sendDraft } from "@/lib/send";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Sends ONE candidate's draft. Only ever called from an explicit "Confirm & Send" click. */
export async function POST(_req: Request, ctx: RouteContext<"/api/send/[candidateId]">) {
  const denied = await requireSession();
  if (denied) return denied;
  const { candidateId } = await ctx.params;
  const out = await sendDraft(candidateId);
  return NextResponse.json(out, { status: out.ok ? 200 : out.status });
}
