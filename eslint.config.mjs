import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // PII boundary: AI modules and prompts must never be able to read candidate_pii.
    files: ["lib/ai/**/*.ts", "lib/prompts.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["**/pii-store", "@/lib/pii-store"], message: "AI modules must not import pii-store (candidate_pii)." },
            { group: ["**/db", "@/lib/db", "@supabase/*"], message: "AI modules get data as arguments; no DB access." },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
