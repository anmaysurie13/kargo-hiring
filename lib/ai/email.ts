import "server-only";
import { z } from "zod";
import { buildEmailPrompt, INVITE_SYSTEM, REJECTION_SYSTEM } from "../prompts";
import { generateJSON } from "./gemini";

const EmailOut = z.object({ subject: z.string().min(3).max(120), body: z.string().min(40) });
const jsonSchema = {
  type: "object",
  properties: { subject: { type: "string" }, body: { type: "string" } },
  required: ["subject", "body"],
};

export function emailProblems(body: string, type: "invite" | "rejection"): string | null {
  if (!body.includes("{{FIRST_NAME}}")) return "body must greet with the literal token {{FIRST_NAME}}";
  if (/\[REDACTED\]|\[NAME\]|\{\{(?!FIRST_NAME\}\})/i.test(body)) return "body contains a placeholder other than {{FIRST_NAME}}";
  if (!/Arjun Mehta/.test(body)) return "must be signed Arjun Mehta, Founder, Kargo";
  if (type === "rejection" && /\b\d{1,3}\s*\/\s*(100|5)\b|\bscore|\brubric|\brank/i.test(body)) return "rejection must not mention scores, rubric or ranking";
  return null;
}

/** Draft with {{FIRST_NAME}} token; the real name is substituted server-side at preview/send time only. */
export async function generateEmail(args: Parameters<typeof buildEmailPrompt>[0]): Promise<{ subject: string; body: string }> {
  const out = await generateJSON({
    system: args.type === "invite" ? INVITE_SYSTEM : REJECTION_SYSTEM,
    prompt: buildEmailPrompt(args),
    jsonSchema,
    zod: EmailOut,
    check: (v) => emailProblems(v.body, args.type) ?? (/\[REDACTED\]|\{\{/.test(v.subject) ? "subject must not contain placeholders" : null),
    temperature: 0.4,
  });
  return { subject: out.subject.trim(), body: out.body.trim() };
}
