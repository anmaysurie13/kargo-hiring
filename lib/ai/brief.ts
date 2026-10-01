import "server-only";
import { z } from "zod";
import { BRIEF_SYSTEM, buildBriefPrompt } from "../prompts";
import { generateJSON } from "./gemini";

const BriefOut = z.object({ sentences: z.array(z.string().min(10)).length(3) });
const jsonSchema = {
  type: "object",
  properties: { sentences: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 3 } },
  required: ["sentences"],
};

/** Exactly 3 sentences, each ending in terminal punctuation. */
export async function generateBrief(args: Parameters<typeof buildBriefPrompt>[0]): Promise<string> {
  const out = await generateJSON({
    system: BRIEF_SYSTEM,
    prompt: buildBriefPrompt(args),
    jsonSchema,
    zod: BriefOut,
    check: (v) => (v.sentences.some((s) => /\[REDACTED\]|\[NAME\]/i.test(s)) ? "do not use [REDACTED]; say 'the candidate'" : null),
  });
  return out.sentences
    .map((s) => s.replace(/\s+/g, " ").trim())
    .map((s) => (/[.!?]$/.test(s) ? s : `${s}.`))
    .join(" ");
}
