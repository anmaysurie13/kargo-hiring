import { loadSnapshot } from "@/lib/data";
import { requireSession } from "@/lib/guard";
import { firstNameOf } from "@/lib/pii";
import { getAllPII } from "@/lib/pii-store";
import { ROLES } from "@/lib/types";

export const runtime = "nodejs";

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV export. Email/phone are included ONLY when ?include_contact=1. */
export async function GET(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  const includeContact = new URL(req.url).searchParams.get("include_contact") === "1";
  const [snap, pii] = await Promise.all([loadSnapshot(), getAllPII()]);
  const crit = ROLES.flatMap((r) => snap.criteria.filter((c) => c.role === r));

  const header = [
    "rank", "first_name", ...(includeContact ? ["email", "phone"] : []), "applied_role", "status", "pm_total", "spm_total",
    "above_line", ...crit.map((c) => `${c.role}: ${c.name}`), "brief", "email_type", "email_status", "sent_at",
  ];
  const rows = snap.candidates
    .slice()
    .sort((a, b) => a.applied_role.localeCompare(b.applied_role) || (a.ranked?.rank ?? 1e9) - (b.ranked?.rank ?? 1e9))
    .map((c) => {
      const p = pii.get(c.id);
      return [
        c.ranked?.rank ?? "",
        firstNameOf(p?.full_name) ?? "",
        ...(includeContact ? [p?.email ?? "", p?.phone ?? ""] : []),
        c.applied_role,
        c.status,
        c.totals.PM ?? "",
        c.totals.SPM ?? "",
        c.ranked ? (c.ranked.aboveLine ? "yes" : "no") : "",
        ...crit.map((k) => c.scores.find((s) => s.criterion_id === k.id)?.score ?? ""),
        c.briefs.find((b) => b.role === c.applied_role)?.brief_text ?? "",
        c.draft?.type ?? "",
        c.draft?.status ?? "none",
        c.draft?.sent_at ?? "",
      ];
    });
  const csv = [header, ...rows].map((r) => r.map(cell).join(",")).join("\n");
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="kargo-candidates-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
