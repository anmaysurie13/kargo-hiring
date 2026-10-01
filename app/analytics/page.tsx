import Link from "next/link";
import { CriterionChart, FunnelChart, Histogram } from "@/components/Charts";
import { RescoreButton } from "@/components/RescoreButton";
import { Card, PageHeader, StatTile } from "@/components/ui";
import { loadSnapshot } from "@/lib/data";
import { ROLES, roleLabel } from "@/lib/types";

function ago(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60_000))} min`;
  if (h < 48) return `${h} h`;
  return `${Math.floor(h / 24)} days`;
}

export default async function AnalyticsPage() {
  const snap = await loadSnapshot();
  const { candidates, byRole, n, criteria } = snap;

  const perRole = ROLES.map((role) => {
    const applied = candidates.filter((c) => c.applied_role === role);
    const ranked = byRole[role];
    const sent = (t: string) => applied.filter((c) => c.draft?.status === "sent" && c.draft.type === t).length;
    const funnel = [
      { stage: "Uploaded", count: applied.length },
      { stage: "Scored", count: ranked.length },
      { stage: "Above the line", count: ranked.filter((r) => r.aboveLine).length },
      { stage: "Invite sent", count: sent("invite") },
      { stage: "Rejection sent", count: sent("rejection") },
      { stage: "Still unsent", count: ranked.filter((r) => applied.find((c) => c.id === r.id)?.draft?.status !== "sent").length },
    ];
    const buckets = Array.from({ length: 10 }, (_, i) => ({ bucket: i === 9 ? "90–100" : `${i * 10}–${i * 10 + 9}`, count: 0 }));
    for (const r of ranked) buckets[Math.min(9, Math.floor(r.totals[role]! / 10))].count++;
    const lineScore = ranked.length > n ? ranked[n - 1].totals[role]! : null;
    const lineBucket = lineScore != null ? buckets[Math.min(9, Math.floor(lineScore / 10))].bucket : null;
    const crit = criteria
      .filter((k) => k.role === role)
      .map((k) => {
        const s = applied.flatMap((c) => c.scores.filter((x) => x.criterion_id === k.id));
        return { name: `${k.name} (${k.weight})`, avg: s.length ? s.reduce((t, x) => t + x.score, 0) / s.length : 0 };
      });
    return { role, funnel, buckets, lineScore, lineBucket, crit, cross: ranked.filter((r) => r.crossRole).length };
  });

  const errors = candidates.filter((c) => c.status === "error");
  const unsent = candidates.filter((c) => c.ranked && c.draft?.status !== "sent").sort((a, b) => a.created_at.localeCompare(b.created_at));
  const oldest = unsent[0];

  return (
    <div className="space-y-6">
      <PageHeader icon="chart" title="Analytics">Where the pool is strong, where it is thin, and who is still waiting to hear back.</PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Oldest unsent" value={oldest ? ago(oldest.created_at) : "–"} tone="red" hint={oldest ? `${unsent.length} people have not heard back` : "everyone has heard back"} />
        <StatTile label="Applied PM, strong for SPM" value={perRole[0].cross} tone="violet" />
        <StatTile label="Applied SPM, strong for PM" value={perRole[1].cross} tone="violet" />
        <StatTile label="Processing errors" value={errors.length} tone={errors.length ? "red" : "green"} />
      </div>

      {perRole.map((p) => (
        <div key={p.role} className="grid gap-4 lg:grid-cols-3">
          <Card className="p-4">
            <h2 className="font-medium">{roleLabel(p.role)}: funnel</h2>
            <FunnelChart data={p.funnel} />
          </Card>
          <Card className="p-4">
            <h2 className="font-medium">{p.role} score distribution</h2>
            <p className="text-xs text-slate-500">Total /100 in buckets of 10. Red line = shortlist cut (top {n}).</p>
            <Histogram data={p.buckets} lineBucket={p.lineBucket} lineScore={p.lineScore} />
          </Card>
          <Card className="p-4">
            <h2 className="font-medium">{p.role} average per criterion</h2>
            <p className="text-xs text-slate-500">Mean score (1–5) among {p.role} applicants. (weight)</p>
            <CriterionChart data={p.crit} />
          </Card>
        </div>
      ))}

      <Card className="p-4">
        <h2 className="font-medium">Processing errors</h2>
        {errors.length === 0 ? (
          <p className="mt-1 text-sm text-slate-500">None.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {errors.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2 text-sm">
                <Link href={`/candidate/${e.id}`} className="w-56 truncate font-medium hover:underline">{e.original_filename}</Link>
                <span className="flex-1 truncate text-xs text-rose-600" title={e.error_message ?? ""}>{e.error_message}</span>
                <RescoreButton ids={[e.id]} label="Retry" />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// Always render per request: live candidate data behind a password.
export const dynamic = "force-dynamic";
