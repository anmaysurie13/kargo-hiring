import "server-only";
import { z } from "zod";
import { buildScoringPrompt, SCORING_SYSTEM } from "../prompts";
import type { Criterion, Role } from "../types";
import { generateJSON } from "./gemini";

const ScoreOut = z.object({
  scores: z.array(z.object({ criterion_id: z.string(), score: z.number().int().min(1).max(5), reason: z.string().min(3) })),
});

const jsonSchema = {
  type: "object",
  properties: {
    scores: {
      type: "array",
      items: {
        type: "object",
        properties: {
          criterion_id: { type: "string" },
          score: { type: "integer", minimum: 1, maximum: 5 },
          reason: { type: "string" },
        },
        required: ["criterion_id", "score", "reason"],
      },
    },
  },
  required: ["scores"],
};

export type CriterionScore = { criterion_id: string; score: number; reason: string };

/** Score PII-stripped CV content against one role's rubric. */
export async function scoreAgainstRubric(cvContent: string, role: Role, criteria: Criterion[]): Promise<CriterionScore[]> {
  const ids = new Set(criteria.map((c) => c.id));
  const out = await generateJSON({
    system: SCORING_SYSTEM,
    prompt: buildScoringPrompt(cvContent, role, criteria),
    jsonSchema,
    zod: ScoreOut,
    check: (v) => {
      const got = new Set(v.scores.map((s) => s.criterion_id));
      const missing = [...ids].filter((id) => !got.has(id));
      const extra = [...got].filter((id) => !ids.has(id));
      if (missing.length || extra.length || v.scores.length !== ids.size) return `must return exactly one score per criterion id (missing ${missing.length}, unknown ${extra.length})`;
      return null;
    },
  });
  return out.scores.map((s) => ({ ...s, reason: s.reason.replace(/\s*\n+\s*/g, " ").trim() }));
}
