"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { runReconcile } from "./EmailPanel";
import { btn } from "./ui";

async function rescoreOne(id: string): Promise<string | null> {
  for (let i = 0; i < 3; i++) {
    const res = await fetch(`/api/candidates/${id}/score`, { method: "POST" });
    if (res.status === 429 || res.status >= 502) {
      await new Promise((r) => setTimeout(r, 3000 * 2 ** i));
      continue;
    }
    const j = await res.json().catch(() => ({}));
    return res.ok && j.ok ? null : (j.error ?? `HTTP ${res.status}`);
  }
  return "Rate limited; try again later";
}

/** Re-runs scoring (both rubrics). Unsent drafts and briefs are regenerated; sent emails are never altered. */
export function RescoreButton({ ids, label }: { ids: string[]; label?: string }) {
  const router = useRouter();
  const [state, setState] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const many = ids.length > 1;

  async function run() {
    if (many && !confirm(`Rescore all ${ids.length} candidates against the current rubric? Sent emails are never changed.`)) return;
    const errs: string[] = [];
    let done = 0;
    const queue = [...ids];
    await Promise.all(
      [0, 1].map(async () => {
        while (queue.length) {
          const id = queue.shift()!;
          setState(`Rescoring ${++done}/${ids.length}…`);
          const e = await rescoreOne(id);
          if (e) errs.push(e);
        }
      }),
    );
    setState("Redrafting…");
    errs.push(...(await runReconcile()));
    setErrors(errs);
    setState(null);
    router.refresh();
  }

  return (
    <span className="inline-flex flex-col items-end">
      <button className={btn.secondary} disabled={!!state || ids.length === 0} onClick={run}>
        {state ?? label ?? (many ? `Rescore all (${ids.length})` : "Rescore")}
      </button>
      {errors.length > 0 && <span className="mt-1 max-w-xs text-xs text-rose-600">{errors.length} error(s): {errors[0]}</span>}
    </span>
  );
}
