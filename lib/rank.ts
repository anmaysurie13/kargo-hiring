import { otherRole, ROLES, type DraftType, type Role } from "./types";

export type RankInput = {
  id: string;
  applied_role: Role;
  created_at: string;
  decision_override: DraftType | null;
  totals: Record<Role, number | null>;
};

export type Ranked = RankInput & {
  rank: number;
  aboveLine: boolean;
  /** The other role, if their score for it would place them in that role's top N. */
  crossRole: Role | null;
  /** Override if Arjun set one, else follows the line. */
  desiredType: DraftType;
};

/** Pure ranking: within APPLIED role, by that role's total. Only fully scored candidates are passed in. */
export function rankCandidates(cands: RankInput[], n: number) {
  const byRole = {} as Record<Role, Ranked[]>;
  for (const role of ROLES) {
    const sorted = cands
      .filter((c) => c.applied_role === role && c.totals[role] != null)
      .sort((a, b) => b.totals[role]! - a.totals[role]! || a.created_at.localeCompare(b.created_at));
    byRole[role] = sorted.map((c, i) => {
      const aboveLine = i < n;
      return { ...c, rank: i + 1, aboveLine, crossRole: null, desiredType: c.decision_override ?? (aboveLine ? "invite" : "rejection") };
    });
  }
  for (const role of ROLES) {
    const other = otherRole(role);
    for (const c of byRole[role]) {
      const mine = c.totals[other];
      if (mine == null) continue;
      const better = byRole[other].filter((o) => o.totals[other]! > mine).length;
      if (better < n) c.crossRole = other;
    }
  }
  const map = new Map<string, Ranked>();
  for (const role of ROLES) for (const c of byRole[role]) map.set(c.id, c);
  return { byRole, map };
}
