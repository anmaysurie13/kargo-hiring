"use client";

import type { DraftType } from "@/lib/types";

/** Generate pending briefs/drafts until done. Never sends anything. */
export async function runReconcile(): Promise<string[]> {
  const errors: string[] = [];
  for (let i = 0; i < 20; i++) {
    const res = await fetch("/api/reconcile", { method: "POST" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      errors.push(j.error ?? `HTTP ${res.status}`);
      break;
    }
    errors.push(...(j.errors ?? []));
    if (!j.remaining || !j.processed) break;
  }
  return errors;
}

export async function patchCandidate(id: string, body: { decision_override?: DraftType | null; held?: boolean }) {
  const res = await fetch(`/api/candidates/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
}

/**
 * Arjun's call: make sure the candidate's draft is of `type` (override + redraft if needed).
 * Does NOT send. Sending is a separate, confirmed click.
 */
export async function decide(id: string, type: DraftType | null) {
  await patchCandidate(id, { decision_override: type });
  const errs = await runReconcile();
  if (errs.length) throw new Error(errs.join("; "));
}

export async function sendNow(id: string): Promise<string> {
  const res = await fetch(`/api/send/${id}`, { method: "POST" });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
  return j.sentTo as string;
}
