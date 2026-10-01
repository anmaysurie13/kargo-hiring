import Link from "next/link";
import { notFound } from "next/navigation";
import { Breakdown } from "@/components/CandidateCard";
import { EmailPanel } from "@/components/EmailPanel";
import { RescoreButton } from "@/components/RescoreButton";
import { Card, Pill, StatTile } from "@/components/ui";
import { getCandidateContent, loadSnapshot } from "@/lib/data";
import { firstNameOf } from "@/lib/pii";
import { getPII } from "@/lib/pii-store";
import { ROLES, roleLabel } from "@/lib/types";
import { emailEnv, toCard } from "@/lib/view";

export default async function CandidatePage({ params }: PageProps<"/candidate/[id]">) {
  const { id } = await params;
  const [snap, row, pii] = await Promise.all([loadSnapshot(), getCandidateContent(id), getPII(id)]);
  const c = snap.candidates.find((x) => x.id === id);
  if (!c || !row) notFound();

  const firstName = firstNameOf(pii?.full_name) ?? "Unnamed";
  const card = toCard(snap, c, new Map([[id, firstName]]), new Map([[id, pii?.full_name ?? null]]));
  const report = (row.pii_redaction_report ?? {}) as Record<string, number | string>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/?role=${c.applied_role}`} className="text-xs text-slate-500 hover:text-slate-800">← Back to shortlist</Link>
          <h1 className="mt-1 text-2xl font-semibold">{pii?.full_name ?? firstName}</h1>
          <p className="text-sm text-slate-500">
            Applied: {roleLabel(c.applied_role)} · {c.original_filename} · uploaded {new Date(c.created_at).toLocaleDateString("en-IN")}
          </p>
        </div>
        <RescoreButton ids={[id]} />
      </div>

      {c.status === "error" && <Card className="border-rose-300 bg-rose-50 p-4 text-sm text-rose-800">Error: {c.error_message}</Card>}
      {c.status === "processing" && <Card className="p-4 text-sm text-slate-600">Still processing…</Card>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label={`Rank in ${c.applied_role}`} value={c.ranked ? `#${c.ranked.rank}` : "–"} hint={c.ranked ? (c.ranked.aboveLine ? "above the line" : "below the line") : undefined} tone={c.ranked?.aboveLine ? "green" : "slate"} />
        <StatTile label="PM total" value={c.totals.PM?.toFixed(1) ?? "–"} hint="/100" />
        <StatTile label="SPM total" value={c.totals.SPM?.toFixed(1) ?? "–"} hint="/100" />
        <StatTile label="Recommendation" value={c.ranked?.desiredType ?? "–"} tone={c.ranked?.desiredType === "invite" ? "green" : "slate"} hint={c.decision_override ? "manual override" : "follows the line"} />
      </div>

      {card?.brief && (
        <Card className="p-4">
          <div className="text-[11px] font-medium uppercase tracking-wide text-indigo-700">Interview brief ({c.applied_role})</div>
          <p className="mt-1 leading-relaxed">{card.brief}</p>
        </Card>
      )}
      {c.ranked?.crossRole && (
        <Card className="border-violet-200 bg-violet-50 p-3 text-sm text-violet-800">
          Also strong for {c.ranked.crossRole}: their {c.ranked.crossRole} score would place them in that role&apos;s top {snap.n}.
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {ROLES.map((r) => {
          const rows = snap.criteria
            .filter((k) => k.role === r)
            .map((k) => {
              const s = c.scores.find((x) => x.criterion_id === k.id && x.role === r);
              return { criterionId: k.id, name: k.name, weight: k.weight, score: s?.score ?? 0, points: s?.points ?? 0, reason: s?.reason ?? "Not scored" };
            });
          return (
            <Card key={r} className="p-4">
              <div className="mb-1 flex items-center justify-between">
                <h2 className="font-semibold">{roleLabel(r)} scorecard</h2>
                <span className="num text-lg font-semibold">{c.totals[r]?.toFixed(1) ?? "–"}<span className="text-xs text-slate-400">/100</span></span>
              </div>
              {r === c.applied_role && <Pill tone="blue">applied role</Pill>}
              <Breakdown rows={rows} />
            </Card>
          );
        })}
      </div>

      {card && <EmailPanel c={card} email={emailEnv()} />}

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <Card className="p-4">
          <h2 className="font-semibold">CV content as the AI saw it (personal details removed)</h2>
          <pre className="mt-2 max-h-[600px] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">{row.cv_content ?? "(not stored: redaction failed)"}</pre>
        </Card>
        <Card className="h-fit p-4">
          <h2 className="font-semibold">Redaction report</h2>
          <p className="mt-1 text-xs text-slate-500">Counts only. No values are stored here.</p>
          <dl className="mt-3 space-y-1 text-sm">
            {["name", "email", "phone", "url"].map((k) => (
              <div key={k} className="flex justify-between"><dt className="capitalize text-slate-500">{k === "url" ? "Profile/URLs" : k}</dt><dd className="num">{report[k] ?? 0}</dd></div>
            ))}
            <div className="flex justify-between border-t border-slate-100 pt-1"><dt className="text-slate-500">Name found via</dt><dd>{String(report.nameSource ?? "–").replace("_", " ")}</dd></div>
          </dl>
        </Card>
      </div>
    </div>
  );
}

// Always render per request: live candidate data behind a password.
export const dynamic = "force-dynamic";
