"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { EmailEnv } from "@/lib/view-types";
import { runReconcile } from "./EmailPanel";
import { btn } from "./ui";

export function ShortlistControl({ n }: { n: number }) {
  const router = useRouter();
  const [value, setValue] = useState(n);
  const [busy, setBusy] = useState(false);
  async function apply(v: number) {
    if (v < 1 || v > 100 || v === n) return;
    setBusy(true);
    await fetch("/api/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ shortlist_size: v }) });
    router.refresh();
    await runReconcile();
    setBusy(false);
    router.refresh();
  }
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-slate-500">Shortlist size</span>
      <button className={btn.small} disabled={busy || value <= 1} onClick={() => { setValue(value - 1); apply(value - 1); }}>−</button>
      <span className="num w-6 text-center font-semibold">{value}</span>
      <button className={btn.small} disabled={busy || value >= 100} onClick={() => { setValue(value + 1); apply(value + 1); }}>+</button>
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
    return <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">Writing {pending} brief(s)/draft(s)… Nothing is sent.</div>;
  if (state === "error")
    return <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">Some drafts failed: {errors.slice(0, 3).join(" · ")}</div>;
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
      <button className={btn.secondary} disabled={disabled} onClick={() => { setAck(false); setProgress(null); dialog.current?.showModal(); }}>
        {!email.configured ? "Email not configured" : `Send all rejections below the line (${items.length})`}
      </button>
      <dialog ref={dialog} className="m-auto w-full max-w-lg rounded-xl p-0 backdrop:bg-slate-900/40">
        <div className="p-5">
          <h2 className="text-lg font-semibold">Send {items.length} rejection emails?</h2>
          <p className="mt-1 text-sm text-slate-500">
            Look at every name once before anything goes out. Held candidates and anyone you switched to invite are excluded.
            {email.testRecipient && ` Test mode: all emails go to ${email.testRecipient}.`}
          </p>
          <ol className="mt-3 max-h-72 list-decimal overflow-auto rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm">
            {items.map((i) => (
              <li key={i.id} className="py-0.5">
                {i.firstName} <span className="num text-slate-400">{i.total.toFixed(1)}</span>
              </li>
            ))}
          </ol>
          {!progress && (
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
              I have reviewed all {items.length} names above.
            </label>
          )}
          {progress && (
            <div className="mt-3 text-sm">
              Sent {progress.done - progress.failed.length} of {items.length}
              {progress.failed.length > 0 && <ul className="mt-1 text-rose-600">{progress.failed.map((f) => <li key={f}>{f}</li>)}</ul>}
            </div>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button className={btn.secondary} onClick={() => dialog.current?.close()}>{progress?.done === items.length ? "Close" : "Cancel"}</button>
            {!progress && <button className={btn.danger} disabled={!ack} onClick={sendAll}>Confirm & send {items.length}</button>}
          </div>
        </div>
      </dialog>
    </>
  );
}
