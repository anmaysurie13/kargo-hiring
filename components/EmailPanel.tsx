"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { renderBody, unsafeBodyReason } from "@/lib/email-render";
import type { CardData, EmailEnv } from "@/lib/view-types";
import { btn, draftPill } from "./ui";

export async function runReconcile(): Promise<string[]> {
  const errors: string[] = [];
  for (let i = 0; i < 20; i++) {
    const res = await fetch("/api/reconcile", { method: "POST" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      errors.push(j.error ?? `HTTP ${res.status}`);
      break;
    }
    errors.push(...(j.errors ?? []));
    if (!j.remaining || !j.processed) break;
  }
  return errors;
}

/** Email preview / edit / send / switch / hold for one candidate. Nothing is sent without a click + confirm. */
export function EmailPanel({ c, email }: { c: CardData; email: EmailEnv }) {
  const router = useRouter();
  const d = c.draft;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(d?.template ?? "");
  const [subject, setSubject] = useState(d?.subject ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const sent = d?.status === "sent";
  const locked = sent || d?.status === "sending";

  const preview = d ? renderBody(editing ? text : d.template, c.fullName) : "";
  const previewSubject = editing ? subject : d?.subject ?? "";
  const problem = d ? unsafeBodyReason(preview, previewSubject) : null;

  async function act(label: string, fn: () => Promise<Response | void>) {
    setBusy(label);
    setMsg(null);
    try {
      const res = await fn();
      if (res && !res.ok) {
        const j = await res.json().catch(() => ({}));
        setMsg({ ok: false, text: j.error ?? `HTTP ${res.status}` });
      }
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
    setBusy(null);
    router.refresh();
  }

  const patchCandidate = (body: object) => fetch(`/api/candidates/${c.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  async function switchType(to: "invite" | "rejection" | null) {
    await act(to ? `Switching to ${to}…` : "Resetting…", async () => {
      const res = await patchCandidate({ decision_override: to });
      if (!res.ok) return res;
      const errs = await runReconcile();
      if (errs.length) setMsg({ ok: false, text: errs.join("; ") });
    });
  }

  async function save() {
    await act("Saving…", async () => {
      const res = await fetch(`/api/drafts/${c.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ edited_body: text, subject }) });
      if (res.ok) setEditing(false);
      return res;
    });
  }

  async function send() {
    setConfirming(false);
    await act("Sending…", async () => {
      const res = await fetch(`/api/send/${c.id}`, { method: "POST" });
      if (res.ok) {
        const j = await res.json();
        setMsg({ ok: true, text: `Sent to ${j.sentTo}` });
      }
      return res;
    });
  }

  const other = (d?.type ?? c.desiredType) === "invite" ? "rejection" : "invite";
  const sendLabel = !email.configured ? "Email not configured" : email.blocked ? "Set TEST_RECIPIENT_EMAIL" : "Confirm & Send";

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Email</span>
        {draftPill(d, c.held)}
        {c.override && <span className="text-xs text-violet-700">manual override: {c.override} (line says {c.aboveLine ? "invite" : "rejection"})</span>}
        {d?.edited && !sent && <span className="text-xs text-slate-400">edited</span>}
      </div>

      {!d && <p className="text-sm text-slate-500">Draft is being generated…</p>}
      {d && (
        <>
          {editing ? (
            <div className="space-y-2">
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm" />
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} className="w-full rounded-md border border-slate-300 bg-white p-2 font-mono text-xs leading-relaxed" />
              <p className="text-xs text-slate-500">
                Keep <code className="rounded bg-slate-200 px-1">{"{{FIRST_NAME}}"}</code>. It becomes &ldquo;{c.firstName}&rdquo; when sent.
              </p>
            </div>
          ) : (
            <div className="rounded-md border border-slate-200 bg-white p-3">
              <div className="mb-2 text-sm font-medium">{previewSubject}</div>
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">{preview}</pre>
            </div>
          )}
          {sent && (
            <p className="mt-2 text-xs text-slate-500">
              Sent {d.sent_at && new Date(d.sent_at).toLocaleString("en-IN")} to {d.sent_to}. Sent emails are never modified.
            </p>
          )}
          {d.status === "failed" && d.error_message && <p className="mt-2 text-sm text-rose-600">Last attempt failed: {d.error_message}</p>}
          {problem && !sent && <p className="mt-2 text-sm text-rose-600">{problem}</p>}
        </>
      )}

      {msg && <p className={`mt-2 text-sm ${msg.ok ? "text-emerald-700" : "text-rose-600"}`}>{msg.text}</p>}

      {!locked && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {d && !editing && !confirming && (
            <button className={btn.primary} disabled={!!busy || !email.configured || email.blocked || !!problem || c.held} onClick={() => setConfirming(true)}>
              {busy === "Sending…" ? "Sending…" : sendLabel}
            </button>
          )}
          {confirming && (
            <span className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-sm">
              Send this {d?.type} to {c.firstName}
              {email.testRecipient ? ` (test → ${email.testRecipient})` : ""}?
              <button className={btn.small} onClick={send}>Yes, send</button>
              <button className={btn.small} onClick={() => setConfirming(false)}>Cancel</button>
            </span>
          )}
          {d && !editing && <button className={btn.secondary} disabled={!!busy} onClick={() => { setText(d.template); setSubject(d.subject); setEditing(true); }}>Edit</button>}
          {editing && (
            <>
              <button className={btn.primary} disabled={!!busy} onClick={save}>{busy ?? "Save draft"}</button>
              <button className={btn.secondary} onClick={() => setEditing(false)}>Cancel</button>
            </>
          )}
          {!editing && (
            <button className={btn.secondary} disabled={!!busy} onClick={() => switchType(other)}>
              {busy?.startsWith("Switching") ? busy : `Switch to ${other}`}
            </button>
          )}
          {!editing && c.override && <button className={btn.secondary} disabled={!!busy} onClick={() => switchType(null)}>Follow the line</button>}
          {!editing && (
            <button className={btn.secondary} disabled={!!busy} onClick={() => act("…", () => patchCandidate({ held: !c.held }))}>
              {c.held ? "Release hold" : "Hold"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
