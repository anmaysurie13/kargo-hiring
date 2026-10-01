import Link from "next/link";
import { Card, PageHeader, Pill } from "@/components/ui";
import { loadSnapshot, type CandidateView } from "@/lib/data";
import { firstNameOf } from "@/lib/pii";
import { getAllPII } from "@/lib/pii-store";

export default async function PipelinePage() {
  const [snap, pii] = await Promise.all([loadSnapshot(), getAllPII()]);
  const ranked = snap.candidates.filter((c) => c.ranked).sort((a, b) => b.totals[b.applied_role]! - a.totals[a.applied_role]!);
  const sent = (c: CandidateView, t: string) => c.draft?.status === "sent" && c.draft.type === t;

  const cols = [
    { title: "Needs your call", hint: "Recommended invite, not sent yet", bar: "bg-emerald-500", items: ranked.filter((c) => !c.held && c.ranked!.desiredType === "invite" && c.draft?.status !== "sent") },
    { title: "Rejection drafted", hint: "Below the line, not sent yet", bar: "bg-slate-400", items: ranked.filter((c) => !c.held && c.ranked!.desiredType === "rejection" && c.draft?.status !== "sent") },
    { title: "On hold", hint: "You chose to wait", bar: "bg-violet-500", items: ranked.filter((c) => c.held && c.draft?.status !== "sent") },
    { title: "Advancing", hint: "Interview invite sent", bar: "bg-blue-500", items: ranked.filter((c) => sent(c, "invite")) },
    { title: "Declined", hint: "Rejection sent", bar: "bg-rose-500", items: ranked.filter((c) => sent(c, "rejection")) },
  ];

  return (
    <div>
      <PageHeader icon={<span className="text-lg">▥</span>} title="Hiring pipeline">
        Every scored candidate, grouped by where they stand. This board is read-only: emails go out only from a candidate&apos;s card after you press Confirm & Send.
      </PageHeader>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        {cols.map((col) => (
          <Card key={col.title} className="overflow-hidden">
            <div className={`h-1 ${col.bar}`} />
            <div className="border-b border-slate-100 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <span className="font-medium">{col.title}</span>
                <span className="rounded-full bg-slate-100 px-2 text-xs text-slate-600">{col.items.length}</span>
              </div>
              <div className="text-xs text-slate-400">{col.hint}</div>
            </div>
            <div className="max-h-[70vh] space-y-2 overflow-auto p-2">
              {col.items.map((c) => (
                <Link key={c.id} href={`/candidate/${c.id}`} className="block rounded-lg border border-slate-200 bg-white p-2.5 hover:border-indigo-300">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{firstNameOf(pii.get(c.id)?.full_name) ?? "Unnamed"}</span>
                    <span className="num text-sm">{c.totals[c.applied_role]!.toFixed(1)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Pill tone="blue">{c.applied_role} #{c.ranked!.rank}</Pill>
                    {c.ranked!.crossRole && <Pill tone="violet">+{c.ranked!.crossRole}</Pill>}
                    {c.decision_override && <Pill tone="amber">override</Pill>}
                  </div>
                </Link>
              ))}
              {col.items.length === 0 && <p className="p-2 text-xs text-slate-400">Empty</p>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Always render per request: live candidate data behind a password.
export const dynamic = "force-dynamic";
