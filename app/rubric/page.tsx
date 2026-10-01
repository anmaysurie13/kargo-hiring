import { Card, PageHeader, Pill } from "@/components/ui";
import { SCORING_SCALE } from "@/lib/prompts";
import { rubricHealth } from "@/lib/rubric";
import { ROLES, roleLabel } from "@/lib/types";

export default async function RubricPage() {
  const { ok, errors, criteria } = await rubricHealth();
  return (
    <div className="space-y-6">
      <PageHeader icon="rubric" title="Rubric">
        Exactly what candidates are ranked against, read live from <code>rubric_criteria</code>. Derived from the patterns in Arjun&apos;s best past hires, not the job descriptions.
        Points per criterion = weight × score ÷ 5. Every candidate is scored against both roles.
      </PageHeader>
      {!ok && <Card className="border-rose-300 bg-rose-50 p-4 text-sm text-rose-800">{errors.join(" ")}</Card>}
      <div className="grid gap-4 lg:grid-cols-2">
        {ROLES.map((r) => {
          const rows = criteria.filter((c) => c.role === r);
          const sum = rows.reduce((s, c) => s + c.weight, 0);
          return (
            <Card key={r} className="p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-medium">{roleLabel(r)}</h2>
                <Pill tone={sum === 100 ? "green" : "red"}>weights = {sum}</Pill>
              </div>
              <ol className="mt-3 space-y-3">
                {rows.map((c, i) => (
                  <li key={c.id} className="rounded-lg border border-slate-100 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-medium">{i + 1}. {c.name}</div>
                      <span className="num shrink-0 text-sm font-semibold text-indigo-700">{c.weight}</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded bg-slate-100"><div className="h-1.5 rounded bg-indigo-500" style={{ width: `${c.weight}%` }} /></div>
                    <p className="mt-2 text-sm text-slate-600">{c.description}</p>
                  </li>
                ))}
              </ol>
            </Card>
          );
        })}
      </div>
      <Card className="p-4">
        <h2 className="font-medium">Scoring scale</h2>
        <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-slate-600">{SCORING_SCALE}</pre>
      </Card>
    </div>
  );
}

// Always render per request: live candidate data behind a password.
export const dynamic = "force-dynamic";
