import { NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { scoreCandidate } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 60;

/** STEP 2 (also used for Rescore). Scores against BOTH rubrics. */
export async function POST(_req: Request, ctx: RouteContext<"/api/candidates/[id]/score">) {
  const denied = await requireSession();
  if (denied) return denied;
  const { id } = await ctx.params;
  try {
    const out = await scoreCandidate(id);
    return NextResponse.json(out, { status: out.ok ? 200 : 422 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
