import "server-only";
import type { CandidateView, Snapshot } from "./data";
import { env } from "./env";
import { otherRole, type Role } from "./types";
import type { CardData, EmailEnv } from "./view-types";

export function emailEnv(): EmailEnv {
  const configured = Boolean(env.resendApiKey());
  const testRecipient = env.testRecipient() || null;
  return { configured, testRecipient, blocked: !testRecipient && !env.allowRealSend() };
}

export function toCard(snap: Snapshot, c: CandidateView, names: Map<string, string>, fullNames: Map<string, string | null>): CardData | null {
  const r = c.ranked;
  if (!r) return null;
  const role: Role = c.applied_role;
  const breakdown = snap.criteria
    .filter((k) => k.role === role)
    .map((k) => {
      const s = c.scores.find((x) => x.criterion_id === k.id && x.role === role);
      return { criterionId: k.id, name: k.name, weight: k.weight, score: s?.score ?? 0, points: s?.points ?? 0, reason: s?.reason ?? "" };
    });
  const d = c.draft;
  const other = otherRole(role);
  const otherTotal = c.totals[other];
  const reroute = r.crossRole != null && otherTotal != null && otherTotal > c.totals[role]!;
  const tier = r.desiredType === "invite" ? "INTERVIEW" : r.crossRole ? "REVIEW" : "PASS";
  return {
    id: c.id,
    rank: r.rank,
    firstName: names.get(c.id) ?? "Unnamed",
    fullName: fullNames.get(c.id) ?? null,
    filename: c.original_filename,
    appliedRole: role,
    total: c.totals[role]!,
    otherTotal,
    crossRole: r.crossRole,
    recommendedRole: reroute ? other : role,
    reroute,
    tier,
    aboveLine: r.aboveLine,
    desiredType: r.desiredType,
    override: c.decision_override,
    held: c.held,
    breakdown,
    brief: c.briefs.find((b) => b.role === role)?.brief_text ?? null,
    draft: d
      ? {
          type: d.type,
          subject: d.subject,
          template: d.edited_body ?? d.body_template,
          edited: d.edited_body != null,
          status: d.status,
          sent_at: d.sent_at,
          sent_to: d.sent_to,
          error_message: d.error_message,
        }
      : null,
  };
}
