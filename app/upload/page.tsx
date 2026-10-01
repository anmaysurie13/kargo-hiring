"use client";

import Link from "next/link";
import Papa from "papaparse";
import { useRef, useState } from "react";
import { runReconcile } from "@/components/actions";
import { btn, Card, PageHeader, Pill } from "@/components/ui";
import type { Role } from "@/lib/types";

type Stage = "queued" | "parsing" | "scoring" | "done" | "error";
type Item = {
  key: string;
  filename: string;
  stage: Stage;
  error?: string;
  candidateId?: string;
  source: { kind: "file"; file: File; role: Role; pii?: Pii } | { kind: "text"; text: string; role: Role; pii?: Pii } | { kind: "zip" };
};
type Pii = { name?: string; email?: string; phone?: string };
type CsvRow = { filename?: string; cv_text?: string; applied_role?: string; name?: string; email?: string; phone?: string };

const CONCURRENCY = 2;
let seq = 0;
const nextKey = () => `b${++seq}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** fetch with exponential backoff on 429 / 5xx (Gemini free-tier rate limits, cold starts). */
async function fetchRetry(url: string, init: RequestInit, attempts = 4): Promise<Response> {
  for (let i = 0; ; i++) {
    const res = await fetch(url, init);
    if ((res.status === 429 || res.status >= 502) && i < attempts - 1) {
      await sleep(3000 * 2 ** i);
      continue;
    }
    return res;
  }
}

const roleOf = (v: string | undefined, fallback: Role): Role => {
  const r = (v ?? "").trim().toUpperCase();
  return r === "PM" || r === "SPM" ? r : fallback;
};

export default function UploadPage() {
  const [role, setRole] = useState<Role>("PM");
  const [items, setItems] = useState<Item[]>([]);
  const [csv, setCsv] = useState<{ rows: CsvRow[]; name: string } | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [drag, setDrag] = useState(false);
  const [selected, setSelected] = useState<File[]>([]);
  const [drafting, setDrafting] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const reconcileChain = useRef<Promise<void>>(Promise.resolve());

  const update = (key: string, patch: Partial<Item>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  function scheduleReconcile() {
    // Serialised so only one drafting loop runs at a time.
    reconcileChain.current = reconcileChain.current.then(async () => {
      setDrafting("Ranking & drafting briefs/emails… (nothing is sent)");
      const errs = await runReconcile();
      setDrafting(errs.length ? `Some drafts failed: ${errs.slice(0, 2).join(" · ")}` : null);
    });
  }

  async function score(item: Item, candidateId: string) {
    update(item.key, { stage: "scoring", candidateId, error: undefined });
    const res = await fetchRetry(`/api/candidates/${candidateId}/score`, { method: "POST" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) return update(item.key, { stage: "error", error: j.error ?? `Scoring failed (HTTP ${res.status})` });
    update(item.key, { stage: "done" });
    scheduleReconcile();
  }

  async function processItem(item: Item) {
    if (item.candidateId) return score(item, item.candidateId);
    if (item.source.kind === "zip") return;
    update(item.key, { stage: "parsing", error: undefined });
    let res: Response;
    const pii = item.source.pii ?? {};
    if (item.source.kind === "file") {
      const fd = new FormData();
      fd.append("file", item.source.file);
      fd.append("role", item.source.role);
      for (const [k, v] of Object.entries(pii)) if (v) fd.append(k, v);
      res = await fetchRetry("/api/ingest", { method: "POST", body: fd });
    } else {
      res = await fetchRetry("/api/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cv_text: item.source.text, filename: item.filename, applied_role: item.source.role, ...pii }),
      });
    }
    const j = await res.json().catch(() => ({}));
    if (j.id && j.error) return update(item.key, { stage: "error", candidateId: undefined, error: j.error });
    if (!res.ok || !j.id) return update(item.key, { stage: "error", error: j.error ?? `Upload failed (HTTP ${res.status})` });
    await score(item, j.id);
  }

  async function runQueue(queue: Item[]) {
    const work = [...queue];
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        while (work.length) await processItem(work.shift()!);
      }),
    );
  }

  async function processZip(zip: File, rows: CsvRow[]) {
    const key = `zip-${nextKey()}`;
    const zipItem: Item = { key, filename: `${zip.name} (unzipping…)`, stage: "parsing", source: { kind: "zip" } };
    setItems((xs) => [zipItem, ...xs]);
    const fd = new FormData();
    fd.append("file", zip);
    fd.append("role", role);
    fd.append("rows", JSON.stringify(rows));
    const res = await fetchRetry("/api/zip", { method: "POST", body: fd });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return update(key, { stage: "error", filename: zip.name, error: j.error ?? `HTTP ${res.status}` });
    const results = (j.results ?? []) as { filename: string; id?: string; error?: string }[];
    update(key, { stage: "done", filename: `${zip.name}: ${results.length} CVs extracted` });
    const children: Item[] = results.map((r, i) => ({
      key: `${key}-${i}`,
      filename: r.filename,
      stage: r.id && !r.error ? "queued" : "error",
      error: r.error,
      candidateId: r.error ? undefined : r.id,
      source: { kind: "zip" },
    }));
    setItems((xs) => [...children, ...xs]);
    await runQueue(children.filter((c) => c.stage === "queued"));
  }

  async function onFiles(list: FileList | File[]) {
    const files = [...list];
    const csvFile = files.find((f) => /\.csv$/i.test(f.name));
    const others = files.filter((f) => f !== csvFile);
    if (csvFile) {
      const text = await csvFile.text();
      const parsed = Papa.parse<CsvRow>(text, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim().toLowerCase() });
      setCsv({ rows: parsed.data, name: csvFile.name });
      setPendingFiles(others);
      return; // wait for the preview to be confirmed
    }
    await startBatch(others, []);
  }

  async function startBatch(files: File[], rows: CsvRow[]) {
    const zips = files.filter((f) => /\.zip$/i.test(f.name));
    const singles = files.filter((f) => /\.(pdf|docx|txt)$/i.test(f.name));
    const rejected = files.filter((f) => !zips.includes(f) && !singles.includes(f));
    const now = nextKey();
    const rowFor = (name: string) => rows.find((r) => (r.filename ?? "").trim().toLowerCase() === name.toLowerCase());
    const queue: Item[] = singles.map((file, i) => {
      const row = rowFor(file.name);
      return {
        key: `${now}-f${i}`,
        filename: file.name,
        stage: "queued",
        source: { kind: "file", file, role: roleOf(row?.applied_role, role), pii: { name: row?.name, email: row?.email, phone: row?.phone } },
      };
    });
    rows
      .filter((r) => r.cv_text?.trim())
      .forEach((r, i) =>
        queue.push({
          key: `${now}-r${i}`,
          filename: r.filename?.trim() || `csv row ${i + 1}`,
          stage: "queued",
          source: { kind: "text", text: r.cv_text!, role: roleOf(r.applied_role, role), pii: { name: r.name, email: r.email, phone: r.phone } },
        }),
      );
    const missing = rows.filter((r) => !r.cv_text?.trim() && r.filename && !singles.some((f) => f.name.toLowerCase() === r.filename!.trim().toLowerCase()) && zips.length === 0);
    const errs: Item[] = [
      ...rejected.map((f, i) => ({ key: `${now}-x${i}`, filename: f.name, stage: "error" as Stage, error: "Unsupported file type", source: { kind: "zip" as const } })),
      ...missing.map((r, i) => ({ key: `${now}-m${i}`, filename: r.filename!, stage: "error" as Stage, error: "CSV row references a file that was not uploaded", source: { kind: "zip" as const } })),
    ];
    setItems((xs) => [...queue, ...errs, ...xs]);
    for (const z of zips) await processZip(z, rows);
    await runQueue(queue);
  }

  const counts = items.reduce<Record<string, number>>((m, i) => ((m[i.stage] = (m[i.stage] ?? 0) + 1), m), {});

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader icon="upload" title="Upload CVs">
        PDF, DOCX or TXT, a .zip of them, or a .csv (filename or cv_text, applied_role, optional name/email/phone). Each candidate is parsed, stripped of personal
        details in code, and scored against both rubrics the moment it&apos;s uploaded; interview briefs and email drafts follow. Nothing is ever sent from this page:
        every email waits for your Advance / Reject call.
      </PageHeader>

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); setSelected([...e.dataTransfer.files]); }}
        className={`animate-fade-in-up space-y-4 rounded-lg border bg-white p-5 transition-colors ${drag ? "border-indigo-400 bg-indigo-50/40" : "border-slate-200"}`}
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Applied role</label>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900">
            <option value="PM">Product Manager</option>
            <option value="SPM">Senior Product Manager</option>
          </select>
          <p className="mt-1 text-xs text-slate-400">A CSV row&apos;s applied_role overrides this.</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Files</label>
          <input
            ref={input}
            type="file"
            multiple
            accept=".pdf,.docx,.txt,.zip,.csv"
            onChange={(e) => setSelected(e.target.files ? [...e.target.files] : [])}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-white"
          />
          <p className="mt-1 text-xs text-slate-400">{selected.length ? `${selected.length} file(s) selected` : "Or drag and drop files onto this box."}</p>
        </div>
        <button
          className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white transition-all hover:-translate-y-0.5 hover:bg-slate-700 hover:shadow-md active:translate-y-0 disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none"
          disabled={selected.length === 0}
          onClick={() => {
            const files = selected;
            setSelected([]);
            if (input.current) input.current.value = "";
            onFiles(files);
          }}
        >
          Upload &amp; evaluate
        </button>
      </div>

      {csv && (
        <Card className="animate-fade-in-up p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Preview: {csv.name} ({csv.rows.length} rows)</h2>
            <div className="flex gap-2">
              <button className={btn.secondary} onClick={() => setCsv(null)}>Cancel</button>
              <button
                className={btn.primary}
                onClick={() => {
                  const rows = csv.rows;
                  setCsv(null);
                  startBatch(pendingFiles, rows);
                }}
              >
                Process {csv.rows.length} rows
              </button>
            </div>
          </div>
          {pendingFiles.length > 0 && <p className="mt-1 text-xs text-slate-500">With {pendingFiles.length} file(s): {pendingFiles.map((f) => f.name).join(", ")}</p>}
          <div className="mt-3 max-h-80 overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-500">
                <tr><th className="p-2">#</th><th className="p-2">Source</th><th className="p-2">Role</th><th className="p-2">Name</th><th className="p-2">Email</th><th className="p-2">Phone</th></tr>
              </thead>
              <tbody>
                {csv.rows.map((r, i) => {
                  const hasFile = r.filename && (pendingFiles.some((f) => f.name.toLowerCase() === r.filename!.trim().toLowerCase()) || pendingFiles.some((f) => /\.zip$/i.test(f.name)));
                  return (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="p-2 text-slate-400">{i + 1}</td>
                      <td className="max-w-xs truncate p-2">
                        {r.cv_text?.trim() ? <span title={r.cv_text}>text: {r.cv_text.slice(0, 60)}…</span> : r.filename ? <span className={hasFile ? "" : "text-rose-600"}>{r.filename}{!hasFile && " (file not selected)"}</span> : <span className="text-rose-600">no filename or cv_text</span>}
                      </td>
                      <td className="p-2">{roleOf(r.applied_role, role)}</td>
                      <td className="p-2">{r.name || <span className="text-slate-400">auto</span>}</td>
                      <td className="p-2">{r.email ? "✓" : <span className="text-slate-400">auto</span>}</td>
                      <td className="p-2">{r.phone ? "✓" : <span className="text-slate-400">auto</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500">Every row goes through the same PII separation step. Rows that reference a filename need that file (or a .zip) selected together with the CSV.</p>
        </Card>
      )}

      {items.length > 0 && (
        <Card className="animate-fade-in-up p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">Progress</h2>
            <div className="flex gap-2 text-xs text-slate-500">
              {Object.entries(counts).map(([k, v]) => <span key={k}>{k}: {v}</span>)}
            </div>
          </div>
          {drafting && <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{drafting}</p>}
          <ul className="mt-3 divide-y divide-slate-100">
            {items.map((it) => (
              <li key={it.key} className="flex items-center gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{it.filename}</span>
                <StagePill stage={it.stage} />
                {it.error && <span className="max-w-md truncate text-xs text-rose-600" title={it.error}>{it.error}</span>}
                {it.stage === "error" && (it.candidateId || it.source.kind !== "zip") && (
                  <button className={btn.small} onClick={() => processItem(it)}>Retry</button>
                )}
                {it.stage === "done" && it.candidateId && <Link className="text-xs text-indigo-600" href={`/candidate/${it.candidateId}`}>view</Link>}
              </li>
            ))}
          </ul>
          <div className="mt-3"><Link href="/" className={btn.action}>Go to dashboard →</Link></div>
        </Card>
      )}
    </div>
  );
}

function StagePill({ stage }: { stage: Stage }) {
  const tone = stage === "done" ? "green" : stage === "error" ? "red" : stage === "queued" ? "muted" : "blue";
  return <Pill tone={tone}>{stage === "parsing" ? "parsing…" : stage === "scoring" ? "scoring…" : stage}</Pill>;
}
