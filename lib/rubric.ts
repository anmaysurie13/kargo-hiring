import "server-only";
import { db, must } from "./db";
import { validateRubric } from "./scoring-math";
import type { Criterion, Role } from "./types";

export async function loadRubric(): Promise<Criterion[]> {
  return must(await db().from("rubric_criteria").select("id, role, name, description, weight, sort_order").order("role").order("sort_order"), "load rubric") as Criterion[];
}

export async function rubricHealth(): Promise<{ ok: boolean; errors: string[]; criteria: Criterion[] }> {
  try {
    const criteria = await loadRubric();
    const errors = validateRubric(criteria);
    return { ok: errors.length === 0, errors, criteria };
  } catch (e) {
    return { ok: false, errors: [(e as Error).message], criteria: [] };
  }
}

/** Fails loudly. Called before any scoring. */
export async function requireValidRubric(): Promise<Record<Role, Criterion[]>> {
  const { ok, errors, criteria } = await rubricHealth();
  if (!ok) throw new Error(`Rubric invalid: ${errors.join(" ")}`);
  return { PM: criteria.filter((c) => c.role === "PM"), SPM: criteria.filter((c) => c.role === "SPM") };
}
