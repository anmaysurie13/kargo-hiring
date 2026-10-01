import Link from "next/link";
import { ExportButton } from "@/components/ExportButton";
import { RescoreButton } from "@/components/RescoreButton";
import { Card, draftPill, PageHeader, Pill } from "@/components/ui";
import { loadSnapshot } from "@/lib/data";
import { firstNameOf } from "@/lib/pii";
import { getAllPII } from "@/lib/pii-store";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function CandidatesPage({ searchParams }: PageProps<"/candidates">) {
  const sp = await searchParams;
  const q = one(sp.q).trim().toLowerCase();
  const role = one(sp.role);
  const line = one(sp.line);
  const mail = one(sp.mail);
  const min = Number(one(sp.min) || 0);
  const max = Number(one(sp.max) || 100);

  const [snap, pii] = await Promise.all([loadSnapshot(), getAllPII()]);
  const rows = snap.candidates
    .map((c) => ({ c, name: pii.get(c.id)?.full_name ?? null }))
    .filter(({ c, name }) => {
      if (q && !(name ?? "").toLowerCase().includes(q) && !c.original_filename.toLowerCase().includes(q)) return false;
      if (role && c.applied_role !== role) return false;
      const t = c.totals[c.applied_role];
      if ((sp.min || sp.max) && (t == null || t < min || t > max)) return false;
      if (line === "above" && !c.ranked?.aboveLine) return false;
      if (line === "below" && (!c.ranked || c.ranked.aboveLine)) return false;
      if (mail === "none" && c.draft) return false;
      if (mail && mail !== "none" && c.draft?.status !== mail) return false;
      return true;
    })
    .sort((a, b) => b.c.created_at.localeCompare(a.c.created_at));

  const sel = "rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm";
  const scorable = snap.candidates.map((c) => c.id);

  return (
    <div className="space-y-5">
      <PageHeader icon={<span className="text-lg">☰</span>} title="All candidates">
        Every CV ever uploaded, persisted in the database, so you can close the app and pick up exactly where you left off.
      </PageHeader>

      <form className="flex flex-wrap items-end gap-2" action="/candidates">
        <input name="q" defaultValue={q} placeholder="Search name or filename…" className={`${sel} w-56`} />
        <select name="role" defaultValue={role} className={sel}><option value="">Both roles</option><option value="PM">PM</option><option value="SPM">SPM</option></select>
        <label className="text-xs text-slate-500">Score <input name="min" type="number" min={0} max={100} defaultValue={one(sp.min)} placeholder="0" className={`${sel} w-16`} /> – <input name="max" type="number" min={0} max={100} defaultValue={one(sp.max)} placeholder="100" className={`${sel} w-16`} /></label>
        <select name="line" defaultValue={line} className={sel}><option value="">Above & below</option><option value="above">Above the line</option><option value="below">Below the line</option></select>
        <select name="mail" defaultValue={mail} className={sel}><option value="">Any email status</option><option value="none">No draft</option><option value="draft">Draft</option><option value="sent">Sent</option><option value="failed">Failed</option></select>
        <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white">Filter</button>
        <Link href="/candidates" className="px-2 py-1.5 text-sm text-slate-500">Reset</Link>
        <span className="ml-auto flex items-center gap-3">
          <ExportButton />
          <RescoreButton ids={scorable} />
        </span>
      </form>

      <Card className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2">Rank</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">File</th><th className="px-3 py-2">Applied</th>
              <th className="px-3 py-2 text-right">PM</th><th className="px-3 py-2 text-right">SPM</th><th className="px-3 py-2">Line</th><th className="px-3 py-2">Email</th><th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ c, name }) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="num px-3 py-2 text-slate-400">{c.ranked?.rank ?? "–"}</td>
                <td className="px-3 py-2 font-medium">{firstNameOf(name) ?? "Unnamed"}</td>
                <td className="max-w-[200px] truncate px-3 py-2 text-xs text-slate-500" title={c.original_filename}>{c.original_filename}</td>
                <td className="px-3 py-2">{c.applied_role}</td>
                <td className={`num px-3 py-2 text-right ${c.applied_role === "PM" ? "font-semibold" : "text-slate-500"}`}>{c.totals.PM?.toFixed(1) ?? "–"}</td>
                <td className={`num px-3 py-2 text-right ${c.applied_role === "SPM" ? "font-semibold" : "text-slate-500"}`}>{c.totals.SPM?.toFixed(1) ?? "–"}</td>
                <td className="px-3 py-2">
                  {c.status === "error" ? <Pill tone="red" title={c.error_message ?? ""}>error</Pill> : c.status === "processing" ? <Pill tone="amber">processing</Pill> : c.ranked?.aboveLine ? <Pill tone="green">above</Pill> : <Pill>below</Pill>}
                  {c.ranked?.crossRole && <span className="ml-1"><Pill tone="violet">+{c.ranked.crossRole}</Pill></span>}
                </td>
                <td className="px-3 py-2">{c.status === "scored" ? draftPill(c.draft, c.held) : null}</td>
                <td className="px-3 py-2 text-right"><Link href={`/candidate/${c.id}`} className="text-xs text-indigo-600 hover:underline">View →</Link></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-500">No candidates match.</td></tr>}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-slate-400">{rows.length} of {snap.candidates.length} candidates</p>
    </div>
  );
}

// Always render per request: live candidate data behind a password.
export const dynamic = "force-dynamic";
