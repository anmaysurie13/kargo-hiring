import type { Criterion } from "./types";

/** points = weight × score / 5, rounded to 2dp. Computed in code, never by the model. */
export function pointsFor(weight: number, score: number): number {
  return Math.round(((weight * score) / 5) * 100) / 100;
}

export function validateRubric(criteria: Pick<Criterion, "role" | "weight">[]): string[] {
  const errors: string[] = [];
  for (const role of ["PM", "SPM"] as const) {
    const rows = criteria.filter((c) => c.role === role);
    const sum = rows.reduce((s, c) => s + c.weight, 0);
    if (rows.length === 0) errors.push(`No rubric criteria for ${role}. Seed rubric_criteria (db/migrations/0002_seed_rubric.sql).`);
    else if (sum !== 100) errors.push(`${role} rubric weights sum to ${sum}, expected 100.`);
  }
  return errors;
}
