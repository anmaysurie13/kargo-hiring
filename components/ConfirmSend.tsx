"use client";

import { useEffect, useRef } from "react";
import type { EmailEnv } from "@/lib/view-types";
import { btn } from "./ui";

/** The confirmation every send goes through. Nothing is sent until "Send now" is clicked here. */
export function ConfirmSend({
  open,
  firstName,
  type,
  subject,
  email,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  firstName: string;
  type: "invite" | "rejection";
  subject?: string;
  email: EmailEnv;
  busy: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal();
    if (!open && ref.current?.open) ref.current.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} className="m-auto w-full max-w-md rounded-lg border border-slate-200 p-0 shadow-xl backdrop:bg-slate-900/30">
      <div className="space-y-3 p-5">
        <h2 className="font-medium text-slate-900">
          Send the {type === "invite" ? "interview invite" : "rejection"} to {firstName}?
        </h2>
        {subject && <p className="text-sm text-slate-600">Subject: {subject}</p>}
        <p className="text-xs text-slate-500">
          {email.testRecipient ? `Test mode: this goes to ${email.testRecipient}, not the candidate.` : "This goes to the candidate's email address."} Sent emails can&apos;t be changed.
        </p>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button className={btn.action} onClick={onClose} disabled={busy}>
            Not yet
          </button>
          <button className={type === "invite" ? btn.advance : btn.danger} onClick={onConfirm} disabled={busy}>
            {busy ? "Sending…" : "Send now"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
