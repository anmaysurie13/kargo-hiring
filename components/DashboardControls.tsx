"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { EmailEnv } from "@/lib/view-types";
import { runReconcile } from "./actions";
import { btn } from "./ui";

export function ShortlistControl({ n }: { n: number }) {
  const router = useRouter();
  const [value, setValue] = useState(n);
  const [busy, setBusy] = useState(false);
  async function apply(v: number) {
    if (v < 1 || v > 100) return;
    setValue(v);
    setBusy(true);
    await fetch("/api/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ shortlist_size: v }) });
    router.refresh();
    await runReconcile();
    setBusy(false);
    router.refresh();
  }
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-slate-500">Shortlist size (per role)</span>
      <span className="inline-flex items-center rounded-md border border-slate-300">
        <button className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40" disabled={busy || value <= 1} onClick={() => apply(value - 1)}>−</button>
        <span className="num w-8 border-x border-slate-300 py-1 text-center text-slate-900">{value}</span>
        <button className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40" disabled={busy || value >= 100} onClick={() => apply(value + 1)}>+</button>
      </span>
      {busy && <span className="text-xs text-slate-400">re-ranking & redrafting…</span>}
    </div>
  );
}

/** Generates pending briefs/drafts (never sends). Runs whenever the dashboard has pending work. */
export function DraftReconciler({ pending }: { pending: number }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "error">("idle");
  const [errors, setErrors] = useState<string[]>([]);
  const started = useRef(false);
  useEffect(() => {
    if (pending === 0 || started.current) return;
    started.current = true;
    setState("running");
    runReconcile().then((errs) => {
      setErrors(errs);
      setState(errs.length ? "error" : "idle");
      started.current = false;
      router.refresh();
    });
  }, [pending, router]);
  if (state === "running")
    return (
      <div className="animate-fade-in rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Writing {pending} interview brief(s) / email draft(s)… Nothing is sent.
      </div>
    );
  if (state === "error")
    return <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">Some drafts failed: {errors.slice(0, 3).join(" · ")}</div>;
  return null;
}

export type BulkItem = { id: string; firstName: string; total: number };

/** Sends below-the-line rejections ONLY after Arjun has seen every name in a confirmation dialog. */
export function BulkRejectButton({ items, email }: { items: BulkItem[]; email: EmailEnv }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [ack, setAck] = useState(false);
  const [progress, setProgress] = useState<{ done: number; failed: string[] } | null>(null);
  const disabled = items.length === 0 || !email.configured || email.blocked;

  async function sendAll() {
    setProgress({ done: 0, failed: [] });
    const failed: string[] = [];
    for (let i = 0; i < items.length; i++) {
      const res = await fetch(`/api/send/${items[i].id}`, { method: "POST" });
      if (!res.ok) failed.push(`${items[i].firstName}: ${(await res.json().catch(() => ({}))).error ?? res.status}`);
      setProgress({ done: i + 1, failed: [...failed] });
    }
    router.refresh();
  }

  return (
    <>
      <button className={btn.action} disabled={disabled} onClick={() => { setAck(false); setProgress(null); dialog.current?.showModal(); }}>
        {!email.configured ? "Email not configured" : `Send all rejections below the line (${items.length})`}
      </button>
      <dialog ref={dialog} className="m-auto w-full max-w-lg rounded-lg border border-slate-200 p-0 shadow-xl backdrop:bg-slate-900/30">
        <div className="space-y-3 p-5">
          <h2 className="font-medium">Send {items.length} rejection emails?</h2>
          <p className="text-xs text-slate-500">
            Look at every name once before anything goes out. Held candidates and anyone you advanced are excluded.
            {email.testRecipient && ` Test mode: all emails go to ${email.testRecipient}.`}
          </p>
          <ol className="max-h-72 list-decimal overflow-auto rounded-md border border-slate-200 py-2 pl-9 pr-3 text-sm">
            {items.map((i) => (
              <li key={i.id} className="py-0.5">
                {i.firstName} <span className="num text-slate-400">{i.total.toFixed(1)}</span>
              </li>
            ))}
          </ol>
          {!progress && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
              I have reviewed all {items.length} names above.
            </label>
          )}
          {progress && (
            <div className="text-sm">
              Sent {progress.done - progress.failed.length} of {items.length}
              {progress.failed.length > 0 && <ul className="mt-1 text-xs text-rose-600">{progress.failed.map((f) => <li key={f}>{f}</li>)}</ul>}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button className={btn.action} onClick={() => dialog.current?.close()}>{progress?.done === items.length ? "Close" : "Cancel"}</button>
            {!progress && <button className={btn.danger} disabled={!ack} onClick={sendAll}>Confirm & send {items.length}</button>}
          </div>
        </div>
      </dialog>
    </>
  );
}
