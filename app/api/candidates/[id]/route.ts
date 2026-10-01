import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/guard";

/** Arjun's manual decisions: override the line (invite / rejection / null = follow the line) or hold. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/candidates/[id]">) {
  const denied = await requireSession();
  if (denied) return denied;
  const { id } = await ctx.params;
  const b = (await req.json()) as { decision_override?: string | null; held?: boolean };
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("decision_override" in b) {
    if (b.decision_override !== null && b.decision_override !== "invite" && b.decision_override !== "rejection")
      return NextResponse.json({ error: "decision_override must be invite, rejection or null" }, { status: 400 });
    patch.decision_override = b.decision_override;
  }
  if (typeof b.held === "boolean") patch.held = b.held;
  const { error } = await db().from("candidates").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
