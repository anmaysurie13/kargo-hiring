import "server-only";
import { Resend } from "resend";
import { db, must } from "./db";
import { renderBody, unsafeBodyReason } from "./email-render";
import { env } from "./env";
import { getPII } from "./pii-store";
import type { DraftRow } from "./types";

export type SendResult = { ok: true; sentTo: string; messageId: string } | { ok: false; error: string; status: number };

export function emailConfigured() {
  return Boolean(env.resendApiKey());
}

/** The ONLY code path that sends email. Always triggered by Arjun clicking a button. */
export async function sendDraft(candidateId: string): Promise<SendResult> {
  if (!emailConfigured()) return { ok: false, status: 400, error: "Email not configured (RESEND_API_KEY is blank)." };
  const testTo = env.testRecipient();
  if (!testTo && !env.allowRealSend()) {
    return { ok: false, status: 400, error: "Sending blocked: set TEST_RECIPIENT_EMAIL (course-environment safety)." };
  }

  const draft = must(await db().from("email_drafts").select("*").eq("candidate_id", candidateId).maybeSingle(), "load draft") as DraftRow | null;
  if (!draft) return { ok: false, status: 404, error: "No draft for this candidate yet." };
  if (draft.status === "sent") return { ok: false, status: 409, error: `Already sent ${draft.sent_at}. Refusing to send twice.` };
  if (draft.status === "sending") return { ok: false, status: 409, error: "A send is already in progress." };

  const pii = await getPII(candidateId);
  if (!pii?.email) return { ok: false, status: 400, error: "No email address was found in this CV." };

  const body = renderBody(draft.edited_body ?? draft.body_template, pii.full_name);
  const blocked = unsafeBodyReason(body, draft.subject);
  if (blocked) return { ok: false, status: 400, error: blocked };

  // Atomic claim: only one request can move draft/failed → sending.
  const claimed = must(
    await db().from("email_drafts").update({ status: "sending", updated_at: new Date().toISOString() }).eq("id", draft.id).in("status", ["draft", "failed"]).select("id"),
    "claim draft",
  ) as { id: string }[];
  if (claimed.length === 0) return { ok: false, status: 409, error: "Draft is no longer sendable (already sent or sending)." };

  const to = testTo || pii.email;
  const subject = testTo ? `[TEST → ${pii.email}] ${draft.subject}` : draft.subject;
  const resend = new Resend(env.resendApiKey());
  let error: string | null = null;
  let messageId = "";
  try {
    const res = await resend.emails.send({ from: env.emailFrom(), to, subject, text: body }, { idempotencyKey: `draft-${draft.id}-${draft.updated_at}` });
    if (res.error) {
      const e = res.error as { message: string; statusCode?: number | null; name?: string };
      error =
        e.statusCode === 403 || /own email address|verify a domain/i.test(e.message)
          ? `Resend refused (403): with the onboarding@resend.dev sender and no verified domain, Resend only delivers to the email that owns the Resend account. Set TEST_RECIPIENT_EMAIL to that address, or verify a domain. (${e.message})`
          : `Resend error: ${e.message}`;
    } else messageId = res.data?.id ?? "";
  } catch (e) {
    error = `Send failed: ${(e as Error).message}`;
  }

  if (error) {
    await db().from("email_drafts").update({ status: "failed", error_message: error, updated_at: new Date().toISOString() }).eq("id", draft.id);
    return { ok: false, status: 502, error };
  }
  must(
    await db()
      .from("email_drafts")
      .update({ status: "sent", sent_at: new Date().toISOString(), resend_message_id: messageId, sent_to: to, error_message: null, updated_at: new Date().toISOString() })
      .eq("id", draft.id),
    "mark sent",
  );
  return { ok: true, sentTo: to, messageId };
}
