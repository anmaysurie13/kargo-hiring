import "server-only";
import { generateBrief } from "./ai/brief";
import { generateEmail } from "./ai/email";
import { scoreAgainstRubric } from "./ai/score";
import { getCandidateContent, loadSnapshot, type Snapshot } from "./data";
import { db, must } from "./db";
import { JOB_DESCRIPTIONS } from "./jd";
import { assertNoPII, PIILeakError, separatePII, type ExtractedPII } from "./pii";
import { getAllPII, getPII, savePII, type PIIRow } from "./pii-store";
import { requireValidRubric } from "./rubric";
import { pointsFor } from "./scoring-math";
import { ROLES, type Role } from "./types";

const toPII = (r: PIIRow | null): ExtractedPII => ({ fullName: r?.full_name ?? null, email: r?.email ?? null, phone: r?.phone ?? null });

async function setError(id: string, message: string) {
  await db().from("candidates").update({ status: "error", error_message: message.slice(0, 500), updated_at: new Date().toISOString() }).eq("id", id);
}

// ---------- STEP 1: parse + PII separation (no AI) ----------

export async function ingest(args: { filename: string; role: Role; rawText: string; provided?: Partial<ExtractedPII> }): Promise<{ id: string; error?: string }> {
  let separated: ReturnType<typeof separatePII> | null = null;
  let leak: string | null = null;
  try {
    separated = separatePII(args.rawText, args.filename, args.provided);
  } catch (e) {
    if (!(e instanceof PIILeakError)) throw e;
    leak = e.message;
  }
  const row = must(
    await db()
      .from("candidates")
      .insert({
        applied_role: args.role,
        original_filename: args.filename,
        status: leak ? "error" : "processing",
        error_message: leak,
        // If redaction failed we do NOT store the text: it would still contain PII.
        cv_content: separated?.content ?? null,
        pii_redaction_report: separated?.report ?? null,
      })
      .select("id")
      .single(),
    "insert candidate",
  ) as { id: string };
  if (separated) await savePII(row.id, separated.pii);
  return { id: row.id, error: leak ?? undefined };
}

// ---------- STEP 2: score against BOTH rubrics ----------

export async function scoreCandidate(id: string): Promise<{ ok: boolean; error?: string }> {
  const rubric = await requireValidRubric();
  const cand = await getCandidateContent(id);
  if (!cand) return { ok: false, error: "Candidate not found" };
  if (!cand.cv_content) {
    const error = "No stripped CV content (redaction failed at upload). Re-upload the file.";
    await setError(id, error);
    return { ok: false, error };
  }
  try {
    assertNoPII(cand.cv_content, toPII(await getPII(id)));
  } catch (e) {
    await setError(id, (e as Error).message);
    return { ok: false, error: (e as Error).message };
  }

  await db().from("candidates").update({ status: "processing", error_message: null, updated_at: new Date().toISOString() }).eq("id", id);
  try {
    const rows = [];
    for (const role of ROLES) {
      const criteria = rubric[role];
      const out = await scoreAgainstRubric(cand.cv_content, role, criteria);
      for (const s of out) {
        const c = criteria.find((x) => x.id === s.criterion_id)!;
        rows.push({ candidate_id: id, role, criterion_id: c.id, score: s.score, reason: s.reason.slice(0, 400), points: pointsFor(c.weight, s.score) });
      }
    }
    must(await db().from("scores").delete().eq("candidate_id", id), "clear scores");
    must(await db().from("scores").insert(rows), "insert scores");
    // Rescoring invalidates the brief and any UNSENT draft. Sent emails are never touched.
    must(await db().from("briefs").delete().eq("candidate_id", id), "clear briefs");
    must(await db().from("email_drafts").delete().eq("candidate_id", id).in("status", ["draft", "failed"]), "clear unsent drafts");
    must(await db().from("candidates").update({ status: "scored", error_message: null, updated_at: new Date().toISOString() }).eq("id", id), "mark scored");
    return { ok: true };
  } catch (e) {
    const msg = `Scoring failed: ${(e as Error).message}`;
    await setError(id, msg);
    return { ok: false, error: msg };
  }
}

// ---------- STEP 3: rank + brief + draft (reconcile) ----------

export type Task = { kind: "brief" | "email"; candidateId: string };

export async function pendingTasks(given?: Snapshot) {
  const snap = given ?? (await loadSnapshot());
  const tasks: Task[] = [];
  for (const c of snap.candidates) {
    const r = c.ranked;
    if (!r) continue;
    const wantsBrief = r.aboveLine || r.desiredType === "invite";
    if (wantsBrief && !c.briefs.some((b) => b.role === c.applied_role)) tasks.push({ kind: "brief", candidateId: c.id });
    const d = c.draft;
    if (!d) tasks.push({ kind: "email", candidateId: c.id });
    else if ((d.status === "draft" || d.status === "failed") && d.type !== r.desiredType) tasks.push({ kind: "email", candidateId: c.id });
  }
  return { snap, tasks };
}

/** Works through pending briefs/drafts until the time budget runs out. Call repeatedly until remaining = 0. */
export async function reconcile(budgetMs = 40_000): Promise<{ processed: number; remaining: number; errors: string[] }> {
  const started = Date.now();
  const { snap, tasks } = await pendingTasks();
  if (tasks.length === 0) return { processed: 0, remaining: 0, errors: [] };
  const pii = await getAllPII();
  const contents = new Map<string, string>();
  const errors: string[] = [];
  let processed = 0;

  for (const task of tasks) {
    if (Date.now() - started > budgetMs) break;
    const c = snap.candidates.find((x) => x.id === task.candidateId)!;
    const r = c.ranked!;
    try {
      if (!contents.has(c.id)) contents.set(c.id, (await getCandidateContent(c.id))?.cv_content ?? "");
      const cv = contents.get(c.id)!;
      assertNoPII(cv, toPII(pii.get(c.id) ?? null)); // privacy guarantee before every AI call
      const role = c.applied_role;
      const scored = snap.criteria
        .filter((k) => k.role === role)
        .map((k) => {
          const s = c.scores.find((x) => x.criterion_id === k.id && x.role === role)!;
          return { name: k.name, weight: k.weight, score: s.score, reason: s.reason };
        });

      if (task.kind === "brief") {
        const brief_text = await generateBrief({ cvContent: cv, role, jd: JOB_DESCRIPTIONS[role], rank: r.rank, total: c.totals[role]!, scored });
        must(await db().from("briefs").upsert({ candidate_id: c.id, role, brief_text, generated_at: new Date().toISOString() }, { onConflict: "candidate_id,role" }), "save brief");
      } else {
        const strengths = [...scored].sort((a, b) => b.score - a.score).slice(0, 3).map((s) => s.reason);
        const email = await generateEmail({ cvContent: cv, role, jd: JOB_DESCRIPTIONS[role], type: r.desiredType, strengths });
        const fields = { type: r.desiredType, subject: email.subject, body_template: email.body, edited_body: null, status: "draft", error_message: null, updated_at: new Date().toISOString() };
        if (c.draft) {
          // Only ever overwrite an UNSENT draft.
          must(await db().from("email_drafts").update(fields).eq("candidate_id", c.id).in("status", ["draft", "failed"]), "update draft");
        } else {
          const res = await db().from("email_drafts").insert({ candidate_id: c.id, ...fields });
          if (res.error && !/duplicate key/i.test(res.error.message)) throw new Error(res.error.message);
        }
      }
      processed++;
    } catch (e) {
      errors.push(`${task.kind} for ${c.original_filename}: ${(e as Error).message}`);
    }
  }
  const after = await pendingTasks();
  return { processed, remaining: after.tasks.length, errors };
}
