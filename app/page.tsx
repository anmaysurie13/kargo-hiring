import Link from "next/link";
import { CandidateCard } from "@/components/CandidateCard";
import { BulkRejectButton, DraftReconciler, ShortlistControl } from "@/components/DashboardControls";
import { HeroArt } from "@/components/HeroArt";
import { btn, Card, StatTile } from "@/components/ui";
import { loadSnapshot } from "@/lib/data";
import { pendingTasks } from "@/lib/pipeline";
import { getAllPII } from "@/lib/pii-store";
import { rubricHealth } from "@/lib/rubric";
import { ROLES, roleLabel, type Role } from "@/lib/types";
import { emailEnv, toCard } from "@/lib/view";
import { firstNameOf } from "@/lib/pii";

export default async function Dashboard({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const role: Role = sp.role === "SPM" ? "SPM" : "PM";
  const filter = sp.f === "unsent" || sp.f === "sent" ? sp.f : "all";

  const health = await rubricHealth();
  if (!health.ok) {
    return (
      <Card className="border-rose-300 bg-rose-50 p-5 text-rose-800">
        <h1 className="font-semibold">Rubric is not valid. Scoring is disabled.</h1>
        <ul className="mt-2 list-disc pl-5 text-sm">{health.errors.map((e) => <li key={e}>{e}</li>)}</ul>
        <p className="mt-2 text-sm">Run db/migrations/0001_init.sql and 0002_seed_rubric.sql in the Supabase SQL Editor (see README).</p>
      </Card>
    );
  }

  const [snap, pii] = await Promise.all([loadSnapshot(), getAllPII()]);
  const { tasks } = await pendingTasks(snap);
  const names = new Map([...pii].map(([id, p]) => [id, firstNameOf(p.full_name) ?? "Unnamed"]));
  const fullNames = new Map([...pii].map(([id, p]) => [id, p.full_name]));
  const email = emailEnv();

  const cards = snap.byRole[role].map((r) => toCard(snap, snap.candidates.find((c) => c.id === r.id)!, names, fullNames)!);
  const visible = cards.filter((c) => (filter === "sent" ? c.draft?.status === "sent" : filter === "unsent" ? c.draft?.status !== "sent" : true));

  const scored = snap.candidates.filter((c) => c.ranked);
  const sentOf = (t: string) => scored.filter((c) => c.draft?.status === "sent" && c.draft.type === t).length;
  const unsent = scored.filter((c) => c.draft && c.draft.status !== "sent").length;
  const processing = snap.candidates.filter((c) => c.status !== "scored").length;

  const bulk = cards
    .filter((c) => c.desiredType === "rejection" && !c.held && c.draft && c.draft.type === "rejection" && (c.draft.status === "draft" || c.draft.status === "failed"))
    .map((c) => ({ id: c.id, firstName: c.firstName, total: c.total }));

  const tab = (r: Role) => `/?role=${r}${filter !== "all" ? `&f=${filter}` : ""}`;
  const filt = (f: string) => `/?role=${role}${f !== "all" ? `&f=${f}` : ""}`;

  return (
    <div className="space-y-5">
      <Card className="relative overflow-hidden bg-gradient-to-br from-white via-white to-indigo-50/60 px-6 py-7 sm:px-8">
        <div className="grid items-center gap-6 md:grid-cols-[1fr_360px]">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-indigo-600">Kargo · Hiring</div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              A shortlist <span className="text-indigo-600">Arjun can trust</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-500">
              Ranked within each applied role, scored against the hire pattern, not the job spec. The system recommends, you decide:
              nothing is sent, rejected or finalised until you click.
            </p>
            <div className="mt-5 flex gap-2">
              <Link href="/upload" className={btn.primary}>Upload CVs</Link>
              <Link href="/pipeline" className={btn.secondary}>View pipeline</Link>
            </div>
          </div>
          <div className="hidden h-48 md:block"><HeroArt /></div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Total scored" value={scored.length} hint={processing ? `${processing} processing / error` : undefined} />
        <StatTile label="Above the line" value={scored.filter((c) => c.ranked!.aboveLine).length} tone="green" hint={`top ${snap.n} per role`} />
        <StatTile label="Invites sent" value={sentOf("invite")} tone="amber" />
        <StatTile label="Rejections sent" value={sentOf("rejection")} tone="slate" />
        <StatTile label="Unsent drafts" value={unsent} tone="violet" hint="nobody has heard back" />
      </div>

      <DraftReconciler pending={tasks.length} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm">
          {ROLES.map((r) => (
            <Link key={r} href={tab(r)} className={`rounded-md px-3 py-1.5 ${r === role ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
              {roleLabel(r)} <span className="opacity-60">({snap.byRole[r].length})</span>
            </Link>
          ))}
        </div>
        <ShortlistControl key={snap.n} n={snap.n} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 text-sm">
          {["all", "unsent", "sent"].map((f) => (
            <Link key={f} href={filt(f)} className={`rounded-md px-2.5 py-1 capitalize ${f === filter ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-500 hover:text-slate-800"}`}>
              {f}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {email.testRecipient && <span className="text-xs text-amber-700">Test mode: all email → {email.testRecipient}</span>}
          {email.configured && email.blocked && <span className="text-xs text-rose-600">Sending blocked until TEST_RECIPIENT_EMAIL is set</span>}
          <BulkRejectButton items={bulk} email={email} />
        </div>
      </div>

      <div className="space-y-2">
        {cards.length === 0 && (
          <Card className="p-8 text-center text-sm text-slate-500">
            No scored {role} candidates yet. <Link href="/upload" className="text-indigo-600 underline">Upload CVs</Link>.
          </Card>
        )}
        {visible.map((c, i) => {
          const prev = visible[i - 1];
          const showLine = prev && prev.aboveLine && !c.aboveLine;
          return (
            <div key={c.id}>
              {showLine && <ShortlistLine n={snap.n} />}
              <CandidateCard c={c} email={email} />
            </div>
          );
        })}
        {visible.length > 0 && visible.every((c) => c.aboveLine) && cards.length > snap.n && <ShortlistLine n={snap.n} />}
      </div>
    </div>
  );
}

function ShortlistLine({ n }: { n: number }) {
  return (
    <div className="my-4 flex items-center gap-3" role="separator">
      <div className="h-0.5 flex-1 bg-gradient-to-r from-rose-400 to-amber-400" />
      <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-0.5 text-xs font-medium text-rose-700">Shortlist line · top {n} above get invites</span>
      <div className="h-0.5 flex-1 bg-gradient-to-r from-amber-400 to-rose-400" />
    </div>
  );
}

// Always render per request: live candidate data behind a password.
export const dynamic = "force-dynamic";
