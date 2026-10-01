import Link from "next/link";
import { ShortlistTable } from "@/components/CandidateCard";
import { BulkRejectButton, DraftReconciler, ShortlistControl } from "@/components/DashboardControls";
import { HeroArt } from "@/components/HeroArt";
import { btn, StatTile } from "@/components/ui";
import { loadSnapshot } from "@/lib/data";
import { firstNameOf } from "@/lib/pii";
import { getAllPII } from "@/lib/pii-store";
import { pendingTasks } from "@/lib/pipeline";
import { rubricHealth } from "@/lib/rubric";
import { ROLES, type Role } from "@/lib/types";
import { emailEnv, toCard } from "@/lib/view";

export default async function Dashboard({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const role: Role = sp.role === "SPM" ? "SPM" : "PM";
  const health = await rubricHealth();

  const hero = (
    <div className="hero-glow animate-fade-in-up relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-indigo-50/40 px-6 py-8 sm:px-10 sm:py-10">
      <div className="relative grid items-center gap-6 md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-indigo-600">Kargo · Hiring</p>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            A shortlist <span className="gradient-text">Arjun can trust</span>
          </h1>
          <p className="mt-3 max-w-md text-sm text-slate-500 sm:text-base">
            Ranked within each applied role, scored against the hire pattern, not the job spec. The system recommends, you decide, and that decision is the last
            thing you touch.
          </p>
          <div className="mt-5 flex gap-2 text-sm">
            <Link href="/upload" className="rounded-md bg-slate-900 px-4 py-2.5 font-medium text-white transition-all hover:-translate-y-0.5 hover:bg-slate-700 hover:shadow-lg active:translate-y-0">
              Upload CVs
            </Link>
            <Link href="/pipeline" className="rounded-md border border-slate-300 bg-white px-4 py-2.5 font-medium text-slate-700 transition-all hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md active:translate-y-0">
              View pipeline
            </Link>
          </div>
        </div>
        <div className="hidden h-64 md:block">
          <HeroArt />
        </div>
      </div>
    </div>
  );

  if (!health.ok) {
    return (
      <div className="space-y-6">
        {hero}
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <p className="font-medium">Rubric is not valid. Scoring is disabled.</p>
          <ul className="mt-1 list-disc pl-5">{health.errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      </div>
    );
  }

  const [snap, pii] = await Promise.all([loadSnapshot(), getAllPII()]);
  const { tasks } = await pendingTasks(snap);
  const names = new Map([...pii].map(([id, p]) => [id, firstNameOf(p.full_name) ?? "Unnamed"]));
  const fullNames = new Map([...pii].map(([id, p]) => [id, p.full_name]));
  const email = emailEnv();
  const byId = new Map(snap.candidates.map((c) => [c.id, c]));

  const all = ROLES.flatMap((r) => snap.byRole[r].map((x) => toCard(snap, byId.get(x.id)!, names, fullNames)!));
  const cards = all.filter((c) => c.appliedRole === role);
  const count = (t: string) => all.filter((c) => c.tier === t).length;
  const processing = snap.candidates.filter((c) => c.status !== "scored").length;

  const bulk = cards
    .filter((c) => c.desiredType === "rejection" && !c.held && c.draft?.type === "rejection" && (c.draft.status === "draft" || c.draft.status === "failed"))
    .map((c) => ({ id: c.id, firstName: c.firstName, total: c.total }));

  return (
    <div className="space-y-6">
      {hero}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatTile label="Total scored" value={all.length} hint={processing ? `${processing} processing / error` : undefined} />
        <StatTile label="Interview" value={count("INTERVIEW")} tone="green" delay={40} />
        <StatTile label="Review" value={count("REVIEW")} tone="amber" delay={80} />
        <StatTile label="Pass" value={count("PASS")} tone="slate" delay={120} />
        <StatTile label="Cross-role" value={all.filter((c) => c.crossRole).length} tone="violet" delay={160} />
      </div>

      <DraftReconciler pending={tasks.length} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ShortlistControl key={snap.n} n={snap.n} />
        <div className="flex flex-wrap items-center gap-3">
          {email.testRecipient && <span className="text-xs text-slate-400">Test mode · all email → {email.testRecipient}</span>}
          <BulkRejectButton items={bulk} email={email} />
        </div>
      </div>

      <ShortlistTable cards={cards} role={role} n={snap.n} email={email} />
      {cards.length === 0 && all.length === 0 && (
        <p className="text-center text-sm text-slate-400">
          Nothing scored yet. <Link href="/upload" className={`${btn.small} ml-1`}>Upload CVs</Link>
        </p>
      )}
    </div>
  );
}

// Always render per request: live candidate data behind a password.
export const dynamic = "force-dynamic";
