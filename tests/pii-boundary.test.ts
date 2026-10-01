import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Enforces the privacy boundary: nothing the AI modules import (directly or transitively)
// may touch candidate_pii. Only lib/pii-store.ts is allowed to name that table.

const ROOT = resolve(__dirname, "..");
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(ROOT, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  else return null; // package import
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) if (existsSync(cand) && statSync(cand).isFile()) return cand;
  return null;
}

function importsOf(file: string): string[] {
  const src = readFileSync(file, "utf8");
  const specs = [...src.matchAll(/(?:import|export)\s[^'"]*?from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1] ?? m[2]);
  return specs.map((s) => resolveImport(file, s)).filter((x): x is string => !!x);
}

function closure(entry: string): Set<string> {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    stack.push(...importsOf(f));
  }
  return seen;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe("PII boundary", () => {
  const aiEntries = [...readdirSync(join(ROOT, "lib/ai")).map((f) => join(ROOT, "lib/ai", f)), join(ROOT, "lib/prompts.ts")];

  for (const entry of aiEntries) {
    it(`${relative(ROOT, entry)} never reaches candidate_pii`, () => {
      const reached = [...closure(entry)].map((f) => relative(ROOT, f).replace(/\\/g, "/"));
      expect(reached).not.toContain("lib/pii-store.ts");
      for (const f of closure(entry)) expect(stripComments(readFileSync(f, "utf8"))).not.toMatch(/candidate_pii/);
    });
  }

  it("only lib/pii-store.ts queries candidate_pii", () => {
    const offenders = [...walk(join(ROOT, "app")), ...walk(join(ROOT, "lib")), ...walk(join(ROOT, "components"))]
      .filter((f) => /from\(\s*["']candidate_pii["']\s*\)/.test(readFileSync(f, "utf8")))
      .map((f) => relative(ROOT, f).replace(/\\/g, "/"));
    expect(offenders).toEqual(["lib/pii-store.ts"]);
  });

  it("no client component imports server data modules", () => {
    const offenders = [...walk(join(ROOT, "app")), ...walk(join(ROOT, "components"))].filter((f) => {
      const src = readFileSync(f, "utf8");
      return /^["']use client["']/m.test(src) && /@\/lib\/(db|pii-store|data|pipeline|send|env|rubric)["']/.test(src);
    });
    expect(offenders).toEqual([]);
  });
});
