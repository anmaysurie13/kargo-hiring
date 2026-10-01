import "server-only";
import { db, must } from "./db";
import { firstNameOf, type ExtractedPII } from "./pii";

// THE ONLY MODULE THAT READS OR WRITES candidate_pii.
// Allowed importers: the send route, server-rendered pages (name display), ingest, export.
// lib/ai/* and lib/prompts.ts must never import this (enforced by tests/pii-boundary.test.ts and ESLint).

export type PIIRow = { candidate_id: string; full_name: string | null; email: string | null; phone: string | null };

export async function savePII(candidateId: string, pii: ExtractedPII) {
  must(
    await db()
      .from("candidate_pii")
      .upsert({ candidate_id: candidateId, full_name: pii.fullName, email: pii.email, phone: pii.phone }, { onConflict: "candidate_id" }),
    "save pii",
  );
}

export async function getPII(candidateId: string): Promise<PIIRow | null> {
  return must(await db().from("candidate_pii").select("*").eq("candidate_id", candidateId).maybeSingle(), "get pii");
}

/** candidate_id → first name, for display only. */
export async function getFirstNames(): Promise<Map<string, string>> {
  const rows = must(await db().from("candidate_pii").select("candidate_id, full_name").range(0, 9999), "names") as Pick<PIIRow, "candidate_id" | "full_name">[];
  return new Map(rows.map((r) => [r.candidate_id, firstNameOf(r.full_name) ?? "Unnamed"]));
}

export async function getAllPII(): Promise<Map<string, PIIRow>> {
  const rows = must(await db().from("candidate_pii").select("*").range(0, 9999), "all pii") as PIIRow[];
  return new Map(rows.map((r) => [r.candidate_id, r]));
}

/** Candidate ids whose full name matches a search string. */
export async function searchByName(q: string): Promise<Set<string>> {
  const rows = must(
    await db().from("candidate_pii").select("candidate_id").ilike("full_name", `%${q.replace(/[%_]/g, "")}%`).range(0, 9999),
    "search pii",
  ) as { candidate_id: string }[];
  return new Set(rows.map((r) => r.candidate_id));
}
