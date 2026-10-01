"use client";

import Link from "next/link";
import { useState } from "react";
import type { CardData, EmailEnv } from "@/lib/view-types";
import { EmailPanel } from "./EmailPanel";
import { draftPill, Pill } from "./ui";

export function ScoreBar({ score }: { score: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${score} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`h-2 w-2 rounded-full ${i <= score ? (score >= 4 ? "bg-emerald-500" : score === 3 ? "bg-amber-400" : "bg-rose-400") : "bg-slate-200"}`} />
      ))}
    </span>
  );
}

export function Breakdown({ rows }: { rows: CardData["breakdown"] }) {
  return (
    <div className="divide-y divide-slate-100">
      {rows.map((b) => (
        <div key={b.criterionId} className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-[220px_1fr]">
          <div>
            <div className="text-sm font-medium text-slate-800">{b.name}</div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
              <ScoreBar score={b.score} /> {b.score}/5 · <span className="num">{b.points.toFixed(1)}</span>/{b.weight} pts
            </div>
          </div>
          <div className="text-sm text-slate-600">{b.reason}</div>
        </div>
      ))}
    </div>
  );
}

export function CandidateCard({ c, email, defaultOpen = false }: { c: CardData; email: EmailEnv; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`rounded-xl border bg-white ${c.aboveLine ? "border-slate-200" : "border-slate-200/70"}`}>
      <button onClick={() => setOpen(!open)} className="grid w-full grid-cols-[36px_1fr_auto] items-center gap-3 px-4 py-3 text-left sm:grid-cols-[36px_1fr_90px_auto]">
        <span className="num text-sm text-slate-400">{c.rank}</span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{c.firstName}</span>
            <Pill tone={c.aboveLine ? "green" : "slate"}>{c.aboveLine ? "ABOVE LINE" : "BELOW LINE"}</Pill>
            <span className="text-xs text-slate-400">applied {c.appliedRole}</span>
            {c.crossRole && <Pill tone="violet" title={`${c.crossRole} score ${c.otherTotal}`}>Also strong for {c.crossRole}</Pill>}
          </span>
          <span className="mt-0.5 block truncate text-xs text-slate-400">{c.brief ?? c.filename}</span>
        </span>
        <span className="num hidden text-right text-lg font-semibold sm:block">
          {c.total.toFixed(1)}
          <span className="text-xs font-normal text-slate-400">/100</span>
        </span>
        <span className="flex items-center gap-2">
          {draftPill(c.draft, c.held)}
          <span className="text-slate-400">{open ? "▴" : "▾"}</span>
        </span>
      </button>
      {open && (
        <div className="space-y-4 border-t border-slate-100 px-4 py-4">
          <div className="flex items-center justify-between sm:hidden">
            <span className="num text-lg font-semibold">{c.total.toFixed(1)}/100</span>
          </div>
          {c.brief && (
            <div className="rounded-lg bg-indigo-50/60 p-3">
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-indigo-700">Interview brief</div>
              <p className="text-sm leading-relaxed text-slate-800">{c.brief}</p>
            </div>
          )}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{c.appliedRole} scorecard</span>
              <Link href={`/candidate/${c.id}`} className="text-xs text-indigo-600 hover:underline">
                Full detail, both roles, CV →
              </Link>
            </div>
            <Breakdown rows={c.breakdown} />
          </div>
          <EmailPanel c={c} email={email} />
        </div>
      )}
    </div>
  );
}
