import { PipelineCard } from "@/components/PipelineCard";
import { PageHeader } from "@/components/ui";
import { loadSnapshot } from "@/lib/data";
import { firstNameOf } from "@/lib/pii";
import { getAllPII } from "@/lib/pii-store";
import { ROLES } from "@/lib/types";
import { emailEnv, toCard } from "@/lib/view";

export default async function PipelinePage() {
  const [snap, pii] = await Promise.all([loadSnapshot(), getAllPII()]);
  const names = new Map([...pii].map(([id, p]) => [id, firstNameOf(p.full_name) ?? "Unnamed"]));
  const fullNames = new Map([...pii].map(([id, p]) => [id, p.full_name]));
  const byId = new Map(snap.candidates.map((c) => [c.id, c]));
  const email = emailEnv();
  const cards = ROLES.flatMap((r) => snap.byRole[r].map((x) => toCard(snap, byId.get(x.id)!, names, fullNames)!)).sort((a, b) => b.total - a.total);
  const sent = (t: string) => cards.filter((c) => c.draft?.status === "sent" && c.draft.type === t);

  const cols = [
    { title: "Needs review", hint: "Scored, waiting on your shortlist call", border: "border-t-slate-400", items: cards.filter((c) => c.draft?.status !== "sent") },
    { title: "Advancing", hint: "Interview invite sent", border: "border-t-blue-500", items: sent("invite") },
    { title: "Declined", hint: "Rejection sent", border: "border-t-rose-500", items: sent("rejection") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader icon="pipeline" title="Hiring pipeline">
        Every scored candidate, grouped by where they stand. Advance or Reject prepares that candidate&apos;s email and asks you to confirm before anything is sent.
      </PageHeader>
      <div className="grid gap-4 md:grid-cols-3">
        {cols.map((col) => (
          <section key={col.title} className={`animate-fade-in-up flex flex-col rounded-lg border border-t-4 border-slate-200 bg-white ${col.border}`}>
            <div className="border-b border-slate-100 px-4 py-3">
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-slate-900">{col.title}</h2>
                <span className="rounded-full bg-slate-50 px-2 py-0.5 text-xs tabular-nums text-slate-400">{col.items.length}</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">{col.hint}</p>
            </div>
            <div className="min-h-[120px] flex-1 space-y-2.5 p-3">
              {col.items.map((c, i) => (
                <PipelineCard key={c.id} c={c} email={email} delay={Math.min(i, 15) * 40} />
              ))}
              {col.items.length === 0 && <p className="px-1 text-xs text-slate-400">Nobody here yet.</p>}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

// Always render per request: live candidate data behind a password.
export const dynamic = "force-dynamic";
