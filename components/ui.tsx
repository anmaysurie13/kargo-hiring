import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white ${className}`}>{children}</div>;
}

const PILL = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  slate: "bg-slate-50 text-slate-600 border-slate-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  red: "bg-rose-50 text-rose-700 border-rose-200",
  violet: "bg-violet-50 text-violet-700 border-violet-200",
} as const;
export type PillTone = keyof typeof PILL;

export function Pill({ tone = "slate", children, title }: { tone?: PillTone; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${PILL[tone]}`}>
      {children}
    </span>
  );
}

const DOT = { indigo: "bg-indigo-500", green: "bg-emerald-500", amber: "bg-amber-500", slate: "bg-slate-400", violet: "bg-violet-500", red: "bg-rose-500" } as const;
const VAL = { indigo: "text-slate-900", green: "text-emerald-700", amber: "text-amber-700", slate: "text-slate-600", violet: "text-violet-700", red: "text-rose-700" } as const;

export function StatTile({ label, value, tone = "indigo", hint }: { label: string; value: ReactNode; tone?: keyof typeof DOT; hint?: string }) {
  return (
    <Card className="px-4 py-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        <span className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} />
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold ${VAL[tone]}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
    </Card>
  );
}

export function PageHeader({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex items-start gap-4">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-200">
        {icon}
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {children && <div className="mt-1 max-w-3xl text-sm text-slate-500">{children}</div>}
      </div>
    </div>
  );
}

export function draftPill(d: { status: string; type: string; sent_at: string | null } | null, held = false) {
  if (held) return <Pill tone="violet">held</Pill>;
  if (!d) return <Pill>no draft yet</Pill>;
  if (d.status === "sent")
    return (
      <Pill tone={d.type === "invite" ? "green" : "slate"} title={d.sent_at ?? ""}>
        {d.type} sent · {d.sent_at ? new Date(d.sent_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : ""}
      </Pill>
    );
  if (d.status === "failed") return <Pill tone="red">failed</Pill>;
  if (d.status === "sending") return <Pill tone="amber">sending…</Pill>;
  return <Pill tone="blue">{d.type} draft</Pill>;
}

export const btn = {
  primary: "inline-flex items-center justify-center gap-1 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300",
  secondary: "inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50",
  danger: "inline-flex items-center justify-center gap-1 rounded-lg bg-rose-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300",
  small: "inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50",
};
