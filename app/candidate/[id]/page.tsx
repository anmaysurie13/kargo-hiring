import Link from "next/link";
import { notFound } from "next/navigation";
import { Breakdown } from "@/components/CandidateCard";
import { EmailPanel } from "@/components/EmailPanel";
import { RescoreButton } from "@/components/RescoreButton";
import { InfoTile } from "@/components/ui";
import { getCandidateContent, loadSnapshot } from "@/lib/data";
import { firstNameOf } from "@/lib/pii";
import { getPII } from "@/lib/pii-store";
import { ROLES, roleLabel } from "@/lib/types";
import { emailEnv, toCard } from "@/lib/view";

const sentences = (t: string) => t.match(/[^.!?]+[.!?]+(\s|$)/g)?.map((s) => s.trim()) ?? [t];

export default async function CandidatePage({ params }: PageProps<"/candidate/[id]">) {
  const { id } = await params;
  const [snap, row, pii] = await Promise.all([loadSnapshot(), getCandidateContent(id), getPII(id)]);
  const c = snap.candidates.find((x) => x.id === id);
  if (!c || !row) notFound();

  const firstName = firstNameOf(pii?.full_name) ?? "Unnamed";
  const card = toCard(snap, c, new Map([[id, firstName]]), new Map([[id, pii?.full_name ?? null]]));
  const report = (row.pii_redaction_report ?? {}) as Record<string, number | string>;
  const brief = card?.brief ? sentences(card.brief) : null;
  const roleCount = snap.byRole[c.applied_role].length;

  const scorecard = (r: (typeof ROLES)[number]) =>
    snap.criteria
      .filter((k) => k.role === r)
      .map((k) => {
        const s = c.scores.find((x) => x.criterion_id === k.id && x.role === r);
        return { criterionId: k.id, name: k.name, weight: k.weight, score: s?.score ?? 0, points: s?.points ?? 0, reason: s?.reason ?? "Not scored" };
      });
  const applied = scorecard(c.applied_role);
  const strongest = [...applied].sort((a, b) => b.score - a.score || b.weight - a.weight)[0];
  const weak = applied.filter((b) => b.score <= 2);

  const summary =
    c.status === "error"
      ? `Error: ${c.error_message}`
      : c.status === "processing"
        ? "Still processing…"
        : card
          ? `Ranked #${card.rank} of ${roleCount} ${c.applied_role} applicants, ${card.aboveLine ? "above" : "below"} the shortlist line (top ${snap.n}). Recommendation: ${card.desiredType === "invite" ? "advance to interview" : "reject"}${card.override ? " (your override)" : ""}.${card.crossRole ? ` Also strong for ${card.crossRole}.` : ""}`
          : "Not ranked yet.";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={`/?role=${c.applied_role}`} className="text-xs text-slate-400 hover:text-slate-700">← Back to shortlist</Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{pii?.full_name ?? firstName}</h1>
          <p className="text-sm text-slate-500">Applied: {c.applied_role} · {c.original_filename}</p>
        </div>
        <RescoreButton ids={[id]} label="Re-run pipeline" />
      </div>

      <div className={`rounded-md border px-4 py-3 text-sm ${c.status === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>{summary}</div>

      {card && (
        <div className="grid gap-4 sm:grid-cols-3">
          <InfoTile label="Recommended role" value={<>{card.recommendedRole}{card.reroute && <span className="ml-1 text-xs font-normal text-indigo-600">reroute?</span>}</>} />
          <InfoTile label="Final tier" value={card.tier} />
          <InfoTile label={`${c.applied_role} score`} value={`${card.total.toFixed(1)} / 100`} />
        </div>
      )}

      {card && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">Why ranked here</div>
          <p className="text-base font-medium text-slate-900">
            {brief?.[1] ?? (strongest ? `Strongest evidence: ${strongest.name} (${strongest.score}/5): ${strongest.reason}` : "–")}
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {ROLES.map((r) => {
          const rows = scorecard(r);
          const rr = snap.byRole[r].find((x) => x.id === id);
          return (
            <div key={r} className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-1 font-medium">{r === "PM" ? "Product Manager fit" : "Senior PM fit"}</h2>
              <p className="mb-2 text-xs text-slate-400">
                Score {c.totals[r]?.toFixed(1) ?? "–"} / 100{rr ? ` · Rank #${rr.rank} in ${r}` : c.applied_role !== r ? ` · applied ${c.applied_role}` : ""}
              </p>
              <Breakdown rows={rows} prefix={r} />
            </div>
          );
        })}
      </div>

      {card && (brief?.[2] || weak.length > 0) && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 font-medium">Probe questions from scoring</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            {brief?.[2] && <li>{brief[2]}</li>}
            {weak.map((w) => (
              <li key={w.criterionId}>
                {w.name} scored {w.score}/5: ask for a concrete example. ({w.reason})
              </li>
            ))}
          </ul>
        </div>
      )}

      {card?.brief && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 font-medium">Interview brief</h2>
          <p className="text-sm text-slate-900">{card.brief}</p>
        </div>
      )}

      {card && <EmailPanel c={card} email={emailEnv()} />}

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 font-medium">CV as the AI saw it (personal details removed)</h2>
          <pre className="max-h-[600px] overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">{row.cv_content ?? "(not stored: redaction failed)"}</pre>
        </div>
        <div className="h-fit rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-medium">Redaction report</h2>
          <p className="mt-1 text-xs text-slate-400">Counts only. No values are stored here.</p>
          <table className="mt-2 w-full text-sm">
            <tbody>
              {["name", "email", "phone", "url"].map((k) => (
                <tr key={k} className="border-t border-slate-100">
                  <td className="py-1.5 text-slate-500">{k === "url" ? "Profile / URLs" : k[0].toUpperCase() + k.slice(1)}</td>
                  <td className="num py-1.5 text-right">{report[k] ?? 0}</td>
                </tr>
              ))}
              <tr className="border-t border-slate-100">
                <td className="py-1.5 text-slate-500">Name found via</td>
                <td className="py-1.5 text-right">{String(report.nameSource ?? "–").replace("_", " ")}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-xs text-slate-400">Applied {roleLabel(c.applied_role)} · uploaded {new Date(c.created_at).toLocaleDateString("en-IN")}</p>
        </div>
      </div>
    </div>
  );
}

// Always render per request: live candidate data behind a password.
export const dynamic = "force-dynamic";
