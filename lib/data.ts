import "server-only";
import { db, must } from "./db";
import { rankCandidates, type Ranked } from "./rank";
import { loadRubric } from "./rubric";
import { ROLES, type BriefRow, type CandidateRow, type Criterion, type DraftRow, type Role, type ScoreRow } from "./types";

const CANDIDATE_COLS = "id, created_at, applied_role, original_filename, status, error_message, pii_redaction_report, decision_override, held";

export async function getShortlistSize(): Promise<number> {
  const row = must(await db().from("settings").select("value").eq("key", "shortlist_size").maybeSingle(), "settings") as { value: string } | null;
  const n = Number(row?.value ?? 5);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 5;
}

export async function setShortlistSize(n: number) {
  must(await db().from("settings").upsert({ key: "shortlist_size", value: String(n) }), "set shortlist");
}

export type CandidateView = Omit<CandidateRow, "cv_content"> & {
  totals: Record<Role, number | null>;
  scores: ScoreRow[];
  briefs: BriefRow[];
  draft: DraftRow | null;
  ranked: Ranked | null;
};

export type Snapshot = {
  n: number;
  criteria: Criterion[];
  candidates: CandidateView[];
  byRole: Record<Role, Ranked[]>;
};

/** Everything the dashboard needs, in one pass. Contains NO personal details. */
export async function loadSnapshot(): Promise<Snapshot> {
  const [n, criteria, cands, scores, briefs, drafts] = await Promise.all([
    getShortlistSize(),
    loadRubric(),
    db().from("candidates").select(CANDIDATE_COLS).order("created_at").range(0, 9999),
    db().from("scores").select("candidate_id, role, criterion_id, score, reason, points").range(0, 49999),
    db().from("briefs").select("candidate_id, role, brief_text, generated_at").range(0, 9999),
    db().from("email_drafts").select("*").range(0, 9999),
  ]);
  const candidates = must(cands, "candidates") as Omit<CandidateRow, "cv_content">[];
  const scoreRows = (must(scores, "scores") as ScoreRow[]).map((s) => ({ ...s, points: Number(s.points) }));
  const briefRows = must(briefs, "briefs") as BriefRow[];
  const draftRows = must(drafts, "drafts") as DraftRow[];

  const critCount = { PM: criteria.filter((c) => c.role === "PM").length, SPM: criteria.filter((c) => c.role === "SPM").length };
  const views: CandidateView[] = candidates.map((c) => {
    const mine = scoreRows.filter((s) => s.candidate_id === c.id);
    const totals = {} as Record<Role, number | null>;
    for (const r of ROLES) {
      const rs = mine.filter((s) => s.role === r);
      totals[r] = critCount[r] > 0 && rs.length === critCount[r] ? Math.round(rs.reduce((t, s) => t + s.points, 0) * 10) / 10 : null;
    }
    return {
      ...c,
      totals,
      scores: mine,
      briefs: briefRows.filter((b) => b.candidate_id === c.id),
      draft: draftRows.find((d) => d.candidate_id === c.id) ?? null,
      ranked: null,
    };
  });

  const scored = views.filter((v) => v.status === "scored" && v.totals.PM != null && v.totals.SPM != null);
  const { byRole, map } = rankCandidates(scored, n);
  for (const v of views) v.ranked = map.get(v.id) ?? null;
  return { n, criteria, candidates: views, byRole };
}

export async function getCandidateContent(id: string): Promise<CandidateRow | null> {
  return must(await db().from("candidates").select("*").eq("id", id).maybeSingle(), "candidate") as CandidateRow | null;
}
