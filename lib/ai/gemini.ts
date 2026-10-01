import "server-only";
import { GoogleGenAI } from "@google/genai";
import type { z } from "zod";
import { env } from "../env";

let ai: GoogleGenAI | null = null;
const client = () => (ai ??= new GoogleGenAI({ apiKey: env.geminiApiKey() }));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function statusOf(e: unknown): number | undefined {
  const s = (e as { status?: number })?.status;
  if (typeof s === "number") return s;
  const m = /"code":\s*(\d{3})|\b(429|500|502|503|504)\b/.exec(String((e as Error)?.message ?? ""));
  return m ? Number(m[1] ?? m[2]) : undefined;
}

/** Exponential backoff on 429 / 5xx: 2s, 4s, 8s, 16s (+ jitter). */
async function withBackoff<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const s = statusOf(e);
      const retryable = s === 429 || (s !== undefined && s >= 500);
      if (!retryable || i >= attempts - 1) throw e;
      await sleep(2000 * 2 ** i + Math.random() * 500);
    }
  }
}

export class AIOutputError extends Error {}

/**
 * Structured JSON call. Validates with zod (+ optional extra check); retries ONCE on invalid output.
 */
export async function generateJSON<T>(opts: {
  system: string;
  prompt: string;
  jsonSchema: object;
  zod: z.ZodType<T>;
  check?: (v: T) => string | null;
  temperature?: number;
}): Promise<T> {
  let lastErr = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt = attempt === 0 ? opts.prompt : `${opts.prompt}\n\nYour previous answer was invalid (${lastErr}). Return valid JSON that follows every rule.`;
    const res = await withBackoff(() =>
      client().models.generateContent({
        model: env.geminiModel(),
        contents: prompt,
        config: {
          systemInstruction: opts.system,
          temperature: opts.temperature ?? 0,
          responseMimeType: "application/json",
          responseJsonSchema: opts.jsonSchema,
        },
      }),
    );
    try {
      const parsed = opts.zod.safeParse(JSON.parse(res.text ?? ""));
      if (!parsed.success) throw new Error(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
      const problem = opts.check?.(parsed.data);
      if (problem) throw new Error(problem);
      return parsed.data;
    } catch (e) {
      lastErr = (e as Error).message.slice(0, 300);
    }
  }
  throw new AIOutputError(`Gemini returned invalid output twice: ${lastErr}`);
}
