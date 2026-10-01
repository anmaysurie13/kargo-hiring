"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { renderBody, unsafeBodyReason } from "@/lib/email-render";
import type { DraftType } from "@/lib/types";
import type { CardData, EmailEnv } from "@/lib/view-types";
import { decide, patchCandidate, sendNow } from "./actions";
import { ConfirmSend } from "./ConfirmSend";
import { btn, draftPill, field } from "./ui";

export { runReconcile } from "./actions";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Shortlist decision + draft email for one candidate. Every send needs a click in ConfirmSend. */
export function EmailPanel({ c, email }: { c: CardData; email: EmailEnv }) {
  const router = useRouter();
  const d = c.draft;
  const sent = d?.status === "sent";
  const locked = sent || d?.status === "sending";

  const rendered = d ? renderBody(d.template, c.fullName) : "";
  const [text, setText] = useState(rendered);
  const [subject, setSubject] = useState(d?.subject ?? "");
  const [synced, setSynced] = useState(`${d?.type}|${d?.template}|${d?.subject}`);
  const key = `${d?.type}|${d?.template}|${d?.subject}`;
  if (key !== synced) {
    // The draft changed on the server (regenerated after a decision); reset the editor.
    setSynced(key);
    setText(rendered);
    setSubject(d?.subject ?? "");
  }
  const dirty = !!d && (text !== rendered || subject !== d.subject);

  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState<DraftType | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
    setBusy(null);
    router.refresh();
  }

  /** Save edits; the real first name is turned back into {{FIRST_NAME}} so it is never stored in the draft. */
  async function save() {
    const template = c.firstName && c.firstName !== "Unnamed" ? text.replace(new RegExp(`\\b${escapeRe(c.firstName)}\\b`, "g"), "{{FIRST_NAME}}") : text;
    const res = await fetch(`/api/drafts/${c.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ edited_body: template, subject }) });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
  }

  /** Advance / Reject: switch the draft type if needed, then ask before sending. */
  async function choose(type: DraftType) {
    await run(type === "invite" ? "Preparing invite…" : "Preparing rejection…", async () => {
      if (c.held) await patchCandidate(c.id, { held: false });
      if (dirty && d?.type === type) await save();
      if (d?.type !== type || c.desiredType !== type) await decide(c.id, type);
      setSendError(null);
      setConfirm(type);
    });
  }

  async function doSend() {
    setBusy("Sending…");
    setSendError(null);
    try {
      if (dirty) await save();
      const to = await sendNow(c.id);
      setConfirm(null);
      setMsg({ ok: true, text: `Sent to ${to}` });
    } catch (e) {
      setSendError((e as Error).message);
    }
    setBusy(null);
    router.refresh();
  }

  const problem = d ? unsafeBodyReason(text, subject) : null;
  const canSend = email.configured && !email.blocked;
  const noSendReason = !email.configured ? "Email not configured" : email.blocked ? "Set TEST_RECIPIENT_EMAIL" : null;

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-medium">Shortlist decision (human — the last thing you touch)</h2>
        <p className="text-xs text-slate-500">
          The system recommends <b>{c.desiredType === "invite" ? "Advance" : "Reject"}</b>
          {c.override ? " (your override)" : ` (${c.aboveLine ? "above" : "below"} the line)`}. Advance or Reject prepares that email and asks you to confirm; nothing is sent
          until you press Send now.
        </p>
        {locked ? (
          <p className="text-sm text-slate-600">
            Decision made: {d?.type === "invite" ? "advanced (invite sent)" : "rejected (rejection sent)"}. Sent emails can&apos;t be undone.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button className={c.desiredType === "invite" ? btn.advance : btn.action} disabled={!!busy || !canSend} onClick={() => choose("invite")} title={noSendReason ?? ""}>
              {busy === "Preparing invite…" ? busy : "Advance"}
            </button>
            <button className={c.desiredType === "rejection" ? btn.danger : btn.action} disabled={!!busy || !canSend} onClick={() => choose("rejection")} title={noSendReason ?? ""}>
              {busy === "Preparing rejection…" ? busy : "Reject"}
            </button>
            <button className={btn.action} disabled={!!busy} onClick={() => run("…", () => patchCandidate(c.id, { held: !c.held }))}>
              {c.held ? "Release hold" : "Hold"}
            </button>
            {(c.override || c.held) && (
              <button className={btn.action} disabled={!!busy} onClick={() => run("Resetting…", async () => { if (c.held) await patchCandidate(c.id, { held: false }); if (c.override) await decide(c.id, null); })}>
                Back to pending
              </button>
            )}
          </div>
        )}
        {noSendReason && !locked && <p className="text-xs text-amber-700">{noSendReason}: sending is disabled.</p>}
      </div>

      <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-slate-400">{d ? (d.type === "invite" ? "Interview invite" : "Rejection") : "Draft email"}</span>
          {draftPill(d, c.held)}
        </div>
        {!d ? (
          <div className="skeleton-shimmer h-24 rounded-md" aria-label="Draft is being written" />
        ) : (
          <>
            <input value={subject} disabled={locked} onChange={(e) => setSubject(e.target.value)} className={`${field.textarea} py-1.5 font-medium`} />
            <textarea value={text} disabled={locked} onChange={(e) => setText(e.target.value)} rows={11} className={field.textarea} />
            {d.status === "failed" && d.error_message && <p className="text-xs text-rose-600">Last error: {d.error_message}</p>}
            {problem && !locked && <p className="text-xs text-rose-600">{problem}</p>}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-500">
                To: {sent ? d.sent_to : email.testRecipient ? `${email.testRecipient} (test mode)` : "the candidate's address"}
                {sent && d.sent_at && ` · sent ${new Date(d.sent_at).toLocaleString("en-IN")}`}
              </span>
              {!locked && (
                <span className="flex gap-2">
                  <button className={btn.action} disabled={!!busy || !dirty} onClick={() => run("Saving…", save)}>
                    {busy === "Saving…" ? "Saving…" : "Save draft"}
                  </button>
                  <button className={btn.advance} disabled={!!busy || !canSend || !!problem || c.held} onClick={() => { setSendError(null); setConfirm(d.type); }} title={noSendReason ?? (c.held ? "Held" : "")}>
                    Send
                  </button>
                </span>
              )}
            </div>
          </>
        )}
        {msg && <p className={`text-sm ${msg.ok ? "text-emerald-700" : "text-rose-600"}`}>{msg.text}</p>}
      </div>

      <ConfirmSend
        open={confirm != null && !!d && d.type === confirm}
        firstName={c.firstName}
        type={confirm ?? "invite"}
        subject={subject}
        email={email}
        busy={busy === "Sending…"}
        error={sendError}
        onConfirm={doSend}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
