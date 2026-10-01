"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DraftType } from "@/lib/types";
import type { CardData, EmailEnv } from "@/lib/view-types";
import { decide, patchCandidate, sendNow } from "./actions";
import { ConfirmSend } from "./ConfirmSend";
import { btn, Pill, tierTone } from "./ui";

/** Kanban card. Advance / Reject prepare the email, then ask before sending: never a one-click send. */
export function PipelineCard({ c, email, delay }: { c: CardData; email: EmailEnv; delay: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<DraftType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sent = c.draft?.status === "sent";
  const canSend = email.configured && !email.blocked;

  async function prepare(type: DraftType) {
    setBusy(true);
    setError(null);
    try {
      if (c.held) await patchCandidate(c.id, { held: false });
      if (c.draft?.type !== type || c.desiredType !== type) await decide(c.id, type);
      setConfirm(type);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
    router.refresh();
  }

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await sendNow(c.id);
      setConfirm(null);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="animate-fade-in-up rounded-md border border-slate-200 p-3 text-sm transition-shadow hover:shadow-sm" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between gap-2">
        <Link href={`/candidate/${c.id}`} className="font-medium leading-tight text-slate-900 hover:underline">
          {c.fullName ?? c.firstName}
        </Link>
        <Pill small tone={tierTone[c.tier]}>{c.tier}</Pill>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span>{c.appliedRole}</span>
        <span className="tabular-nums">{c.total.toFixed(1)}</span>
        {c.crossRole && <span className="text-indigo-600">+{c.crossRole}</span>}
        {c.held && <span className="text-violet-600">held</span>}
        {sent && c.draft?.sent_at && <span>sent {new Date(c.draft.sent_at).toLocaleDateString("en-IN")}</span>}
      </div>
      {!sent && (
        <div className="mt-2 flex gap-1.5">
          <button className={btn.miniAdvance} disabled={busy || !canSend} onClick={() => prepare("invite")}>Advance</button>
          <button className={btn.miniReject} disabled={busy || !canSend} onClick={() => prepare("rejection")}>Reject</button>
          <button className={btn.miniNeutral} disabled={busy} onClick={async () => { setBusy(true); await patchCandidate(c.id, { held: !c.held }); setBusy(false); router.refresh(); }}>
            {c.held ? "Unhold" : "Hold"}
          </button>
        </div>
      )}
      {error && !confirm && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      <ConfirmSend
        open={confirm != null && c.draft?.type === confirm}
        firstName={c.firstName}
        type={confirm ?? "invite"}
        subject={c.draft?.subject}
        email={email}
        busy={busy}
        error={error}
        onConfirm={send}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
