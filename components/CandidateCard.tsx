"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import type { Role } from "@/lib/types";
import type { CardData, EmailEnv } from "@/lib/view-types";
import { EmailPanel } from "./EmailPanel";
import { decisionPill, field, Pill, tierTone } from "./ui";

const dot = (score: number) => (score >= 4 ? "bg-emerald-500" : score === 3 ? "bg-amber-400" : "bg-rose-400");

/** Per-criterion rows, reference style: dot · name / score · points, then the one-line evidence. */
export function Breakdown({ rows, prefix }: { rows: CardData["breakdown"]; prefix?: string }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((b, i) => (
          <tr key={b.criterionId} className="border-t border-slate-100 align-top">
            <td className="w-56 py-2 pr-3">
              <div className="font-medium text-slate-800">
                <span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle ${dot(b.score)}`} />
                {prefix ? `${prefix}${i + 1} · ` : ""}
                {b.name}
              </div>
              <div className="pl-[18px] text-xs text-slate-400">
                {b.score}/5 · <span className="num">{b.points.toFixed(1)}</span>/{b.weight} pts
              </div>
            </td>
            <td className="py-2 text-slate-600">{b.reason}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ShortlistTable({ cards, role, n, email }: { cards: CardData[]; role: Role; n: number; email: EmailEnv }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [tier, setTier] = useState("all");
  const [mail, setMail] = useState("all");
  const [crossOnly, setCrossOnly] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      cards.filter((c) => {
        if (q && !`${c.firstName} ${c.fullName ?? ""} ${c.filename}`.toLowerCase().includes(q.toLowerCase())) return false;
        if (tier !== "all" && c.tier !== tier) return false;
        if (mail === "sent" && c.draft?.status !== "sent") return false;
        if (mail === "unsent" && c.draft?.status === "sent") return false;
        if (crossOnly && !c.crossRole) return false;
        return true;
      }),
    [cards, q, tier, mail, crossOnly],
  );

  return (
    <div className="space-y-4">
      <div className="animate-fade-in-up flex flex-wrap items-center gap-3 text-sm">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name…" className={`${field.input} w-48`} />
        <select value={tier} onChange={(e) => setTier(e.target.value)} className={field.select}>
          <option value="all">All tiers</option>
          <option value="INTERVIEW">Interview</option>
          <option value="REVIEW">Review</option>
          <option value="PASS">Pass</option>
        </select>
        <select value={role} onChange={(e) => router.push(`/?role=${e.target.value}`)} className={field.select}>
          <option value="PM">Applied: Product Manager</option>
          <option value="SPM">Applied: Senior PM</option>
        </select>
        <select value={mail} onChange={(e) => setMail(e.target.value)} className={field.select}>
          <option value="all">All emails</option>
          <option value="unsent">Unsent</option>
          <option value="sent">Sent</option>
        </select>
        <label className="flex items-center gap-1.5 text-slate-600">
          <input type="checkbox" checked={crossOnly} onChange={(e) => setCrossOnly(e.target.checked)} />
          Cross-role flag only
        </label>
        <span className="ml-auto tabular-nums text-slate-400">
          {visible.length} of {cards.length}
        </span>
      </div>

      <div className="animate-fade-in-up overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              {["#", "Candidate", "Applied", "Recommended", "Tier", "Score", role === "PM" ? "SPM fit" : "PM fit", "Flags", "Decision", ""].map((h, i) => (
                <th key={i} className="px-4 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cards.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-slate-400">
                  No scored {role} candidates yet. <Link href="/upload" className="text-indigo-600 hover:underline">Upload CVs</Link>
                </td>
              </tr>
            )}
            {visible.map((c, i) => {
              const prev = visible[i - 1];
              const line = prev && prev.aboveLine && !c.aboveLine;
              const isOpen = open === c.id;
              return (
                <Fragment key={c.id}>
                  {line && <LineRow n={n} />}
                  <tr
                    onClick={() => setOpen(isOpen ? null : c.id)}
                    className={`animate-fade-in-up cursor-pointer border-t border-slate-100 transition-colors hover:bg-slate-50 ${isOpen ? "bg-slate-50" : ""}`}
                    style={{ animationDelay: `${Math.min(i, 20) * 20}ms` }}
                  >
                    <td className="px-4 py-2 text-slate-400">{c.rank}</td>
                    <td className="px-4 py-2">
                      <Link href={`/candidate/${c.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-slate-900 hover:underline">
                        {c.fullName ?? c.firstName}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-slate-500">{c.appliedRole}</td>
                    <td className="px-4 py-2">
                      {c.recommendedRole}
                      {c.reroute && <span className="ml-1 text-xs text-indigo-600">reroute?</span>}
                    </td>
                    <td className="px-4 py-2"><Pill tone={tierTone[c.tier]}>{c.tier}</Pill></td>
                    <td className="px-4 py-2 font-mono">{c.total.toFixed(1)}</td>
                    <td className="px-4 py-2 font-mono text-slate-500">{c.otherTotal?.toFixed(1) ?? "–"}</td>
                    <td className="px-4 py-2">
                      <span className="flex gap-1">
                        {c.crossRole && <Pill tone="violet" title={`Also strong for ${c.crossRole}`}>+{c.crossRole}</Pill>}
                        {c.override && <Pill tone="amber" title="You overrode the line">override</Pill>}
                        {c.draft?.status === "failed" && <Pill tone="red">send failed</Pill>}
                      </span>
                    </td>
                    <td className="px-4 py-2">{decisionPill(c.draft, c.held)}</td>
                    <td className="px-4 py-2 text-right">
                      <span className="text-xs text-slate-500 transition-colors hover:text-slate-900">{isOpen ? "Close ↑" : "Open ↓"}</span>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-t border-slate-100 bg-slate-50/60">
                      <td colSpan={10} className="px-4 py-4">
                        <div className="grid gap-4 lg:grid-cols-2">
                          <div className="space-y-4">
                            {c.brief && (
                              <div className="rounded-lg border border-slate-200 bg-white p-4">
                                <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">Why ranked here · interview brief</div>
                                <p className="text-sm text-slate-900">{c.brief}</p>
                              </div>
                            )}
                            <div className="rounded-lg border border-slate-200 bg-white p-4">
                              <div className="mb-1 flex items-center justify-between">
                                <h3 className="font-medium">{c.appliedRole === "PM" ? "Product Manager fit" : "Senior PM fit"}</h3>
                                <Link href={`/candidate/${c.id}`} className="text-xs text-slate-500 hover:text-slate-900">Full profile →</Link>
                              </div>
                              <p className="mb-2 text-xs text-slate-400">Score {c.total.toFixed(1)} · Tier {c.tier} · Rank #{c.rank} of {cards.length}</p>
                              <Breakdown rows={c.breakdown} prefix={c.appliedRole} />
                            </div>
                          </div>
                          <EmailPanel c={c} email={email} />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {visible.length > 0 && visible.every((c) => c.aboveLine) && cards.length > n && <LineRow n={n} />}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LineRow({ n }: { n: number }) {
  return (
    <tr aria-label="Shortlist line">
      <td colSpan={10} className="px-4 py-1.5">
        <div className="flex items-center gap-3">
          <div className="h-0.5 flex-1 rounded-full bg-gradient-to-r from-indigo-500 to-amber-400" />
          <span className="text-xs font-medium text-slate-500">Shortlist line · top {n} get invites</span>
          <div className="h-0.5 flex-1 rounded-full bg-gradient-to-r from-amber-400 to-indigo-500" />
        </div>
      </td>
    </tr>
  );
}
