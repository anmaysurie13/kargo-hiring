import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-slate-200 bg-white ${className}`}>{children}</div>;
}

const PILL = {
  green: "bg-emerald-100 text-emerald-800 border-emerald-200",
  amber: "bg-amber-100 text-amber-800 border-amber-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
  muted: "bg-slate-50 text-slate-500 border-slate-200",
  blue: "bg-blue-100 text-blue-800 border-blue-200",
  red: "bg-rose-100 text-rose-700 border-rose-200",
  violet: "bg-violet-100 text-violet-800 border-violet-200",
} as const;
export type PillTone = keyof typeof PILL;

export function Pill({ tone = "slate", children, title, small }: { tone?: PillTone; children: ReactNode; title?: string; small?: boolean }) {
  return (
    <span
      title={title}
      className={`inline-block shrink-0 whitespace-nowrap rounded-full border font-medium transition-transform hover:scale-105 ${small ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"} ${PILL[tone]}`}
    >
      {children}
    </span>
  );
}

export type Tier = "INTERVIEW" | "REVIEW" | "PASS";
export const tierTone: Record<Tier, PillTone> = { INTERVIEW: "green", REVIEW: "amber", PASS: "slate" };

const DOT = { indigo: "bg-indigo-500", green: "bg-emerald-500", amber: "bg-amber-500", slate: "bg-slate-400", violet: "bg-violet-500", red: "bg-rose-500" } as const;
const VAL = { indigo: "text-slate-900", green: "text-emerald-700", amber: "text-amber-700", slate: "text-slate-500", violet: "text-violet-700", red: "text-rose-700" } as const;

export function StatTile({ label, value, tone = "indigo", hint, delay = 0 }: { label: string; value: ReactNode; tone?: keyof typeof DOT; hint?: string; delay?: number }) {
  return (
    <div
      className="animate-fade-in-up group relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-1.5">
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${DOT[tone]}`} />
        <span className="text-xs uppercase tracking-wide text-slate-400">{label}</span>
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${VAL[tone]}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

export function InfoTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

export const ICONS = {
  upload: <path d="M12 16V6M12 6l-4 4M12 6l4 4M5 18h14" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  pipeline: (
    <>
      <rect x="4" y="4" width="6" height="16" rx="1.5" stroke="white" strokeWidth="2" />
      <rect x="14" y="4" width="6" height="10" rx="1.5" stroke="white" strokeWidth="2" />
    </>
  ),
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" stroke="white" strokeWidth="2" strokeLinecap="round" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" stroke="white" strokeWidth="2" strokeLinecap="round" />,
  rubric: <path d="M9 5h10M9 12h10M9 19h10M4 5l1 1 2-2M4 12l1 1 2-2M4 19l1 1 2-2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
};

export function PageHeader({ icon, title, children }: { icon: keyof typeof ICONS; title: string; children?: ReactNode }) {
  return (
    <div className="animate-fade-in-up flex items-start gap-4">
      <div className="float-slow flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-sm">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">{ICONS[icon]}</svg>
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {children && <div className="mt-1 text-sm text-slate-500">{children}</div>}
      </div>
    </div>
  );
}

/** Decision pill, reference style: advance / reject / pending (+ held / failed). */
export function decisionPill(d: { status: string; type: string; sent_at: string | null } | null, held = false) {
  if (d?.status === "sent")
    return d.type === "invite" ? <Pill tone="blue" title={`invite sent ${d.sent_at ?? ""}`}>advance</Pill> : <Pill tone="red" title={`rejection sent ${d.sent_at ?? ""}`}>reject</Pill>;
  if (d?.status === "failed") return <Pill tone="red" title="last send failed">failed</Pill>;
  if (d?.status === "sending") return <Pill tone="amber">sending</Pill>;
  if (held) return <Pill tone="violet">held</Pill>;
  return <Pill tone="muted">pending</Pill>;
}

export function draftPill(d: { status: string; type: string; sent_at: string | null } | null, held = false) {
  if (held && d?.status !== "sent") return <Pill tone="violet">held</Pill>;
  if (!d) return <Pill tone="muted">no draft yet</Pill>;
  if (d.status === "sent")
    return (
      <Pill tone={d.type === "invite" ? "blue" : "red"} title={d.sent_at ?? ""}>
        sent · {d.sent_at ? new Date(d.sent_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : ""}
      </Pill>
    );
  if (d.status === "failed") return <Pill tone="red">failed</Pill>;
  if (d.status === "sending") return <Pill tone="amber">sending…</Pill>;
  return <Pill tone="muted">draft</Pill>;
}

export const btn = {
  primary:
    "inline-flex items-center justify-center gap-1 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-all hover:-translate-y-0.5 hover:bg-slate-700 hover:shadow-lg active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none",
  secondary:
    "inline-flex items-center justify-center gap-1 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-all hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0",
  action: "rounded-md border border-slate-300 px-3 py-1.5 text-sm transition-colors hover:bg-slate-100 disabled:opacity-50",
  advance: "rounded-md border border-blue-600 bg-blue-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-blue-700 disabled:opacity-50",
  danger: "rounded-md border border-rose-600 bg-rose-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-rose-700 disabled:opacity-50",
  small: "rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-40",
  miniAdvance: "rounded border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-40",
  miniReject: "rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-40",
  miniNeutral: "rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-40",
};

export const field = {
  input: "rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 transition-shadow focus:outline-none focus:ring-2 focus:ring-slate-300",
  select: "rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 transition-shadow focus:outline-none focus:ring-2 focus:ring-slate-300",
  textarea: "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-50 disabled:text-slate-700",
};
