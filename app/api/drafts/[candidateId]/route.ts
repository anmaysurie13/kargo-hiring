import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/guard";

/** Save Arjun's edits. Sent drafts are immutable. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/drafts/[candidateId]">) {
  const denied = await requireSession();
  if (denied) return denied;
  const { candidateId } = await ctx.params;
  const { edited_body, subject } = (await req.json()) as { edited_body?: string | null; subject?: string };
  const patch: Record<string, unknown> = { edited_body: edited_body?.trim() ? edited_body : null, updated_at: new Date().toISOString() };
  if (subject?.trim()) patch.subject = subject.trim();
  const { data, error } = await db()
    .from("email_drafts")
    .update(patch)
    .eq("candidate_id", candidateId)
    .in("status", ["draft", "failed"])
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: "Draft not found or already sent" }, { status: 409 });
  return NextResponse.json({ ok: true });
}
