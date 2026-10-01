import { NextResponse } from "next/server";
import { jsonError, requireSession } from "@/lib/guard";
import { extractText, SUPPORTED } from "@/lib/parse";
import { ingest } from "@/lib/pipeline";
import { ROLES, type Role } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const asRole = (v: unknown): Role | null => {
  const r = String(v ?? "").trim().toUpperCase() as Role;
  return ROLES.includes(r) ? r : null;
};
const opt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** STEP 1. Multipart {file, role, name?, email?, phone?} or JSON {cv_text, filename?, applied_role, name?, email?, phone?}. */
export async function POST(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  try {
    let filename: string;
    let rawText: string;
    let role: Role | null;
    let provided: { fullName?: string; email?: string; phone?: string };
    if ((req.headers.get("content-type") ?? "").includes("application/json")) {
      const b = (await req.json()) as Record<string, string>;
      role = asRole(b.applied_role ?? b.role);
      filename = opt(b.filename) ?? "csv-row.txt";
      rawText = String(b.cv_text ?? "");
      if (rawText.trim().length < 50) return NextResponse.json({ error: "cv_text is empty or too short" }, { status: 400 });
      provided = { fullName: opt(b.name), email: opt(b.email), phone: opt(b.phone) };
    } else {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
      if (!SUPPORTED.test(file.name)) return NextResponse.json({ error: "Only PDF, DOCX and TXT are supported" }, { status: 400 });
      role = asRole(form.get("role"));
      filename = file.name;
      rawText = await extractText(file.name, new Uint8Array(await file.arrayBuffer()));
      provided = { fullName: opt(form.get("name")), email: opt(form.get("email")), phone: opt(form.get("phone")) };
    }
    if (!role) return NextResponse.json({ error: "role must be PM or SPM" }, { status: 400 });
    const out = await ingest({ filename, role, rawText, provided });
    return NextResponse.json(out, { status: out.error ? 422 : 200 });
  } catch (e) {
    return jsonError(e, 400);
  }
}
