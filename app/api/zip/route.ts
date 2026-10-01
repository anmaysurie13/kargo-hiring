import JSZip from "jszip";
import { NextResponse } from "next/server";
import { jsonError, requireSession } from "@/lib/guard";
import { extractText, SUPPORTED } from "@/lib/parse";
import { ingest } from "@/lib/pipeline";
import { ROLES, type Role } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Unzips server-side and runs STEP 1 (parse + PII separation) for every CV inside.
 * Scoring then happens one candidate per request from the client, to stay inside the function timeout.
 * Optional "rows" field: JSON rows from a CSV ({filename, applied_role, name?, email?, phone?}) overriding role/PII per file.
 */
export async function POST(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  try {
    const form = await req.formData();
    const file = form.get("file");
    const role = String(form.get("role") ?? "").toUpperCase() as Role;
    if (!(file instanceof File)) return NextResponse.json({ error: "No zip file" }, { status: 400 });
    if (!ROLES.includes(role)) return NextResponse.json({ error: "role must be PM or SPM" }, { status: 400 });
    const rows = JSON.parse(String(form.get("rows") ?? "[]")) as Record<string, string>[];

    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const entries = Object.values(zip.files).filter(
      (f) => !f.dir && SUPPORTED.test(f.name) && !f.name.startsWith("__MACOSX/") && !/(^|\/)\./.test(f.name),
    );
    const results: { filename: string; id?: string; error?: string }[] = [];
    for (const entry of entries) {
      const filename = entry.name.split("/").pop()!;
      const row = rows.find((r) => (r.filename ?? "").trim().toLowerCase() === filename.toLowerCase());
      const rowRole = String(row?.applied_role ?? "").trim().toUpperCase() as Role;
      try {
        const rawText = await extractText(filename, await entry.async("uint8array"));
        const out = await ingest({
          filename,
          role: ROLES.includes(rowRole) ? rowRole : role,
          rawText,
          provided: { fullName: row?.name || undefined, email: row?.email || undefined, phone: row?.phone || undefined },
        });
        results.push({ filename, ...out });
      } catch (e) {
        results.push({ filename, error: (e as Error).message });
      }
    }
    return NextResponse.json({ results });
  } catch (e) {
    return jsonError(e, 400);
  }
}
