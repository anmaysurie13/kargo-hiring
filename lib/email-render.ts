import { firstNameOf } from "./pii";

/** Substitute {{FIRST_NAME}} server-side. Name comes from candidate_pii only. */
export function renderBody(template: string, fullName: string | null): string {
  const first = firstNameOf(fullName) ?? "there";
  return template.replace(/\{\{\s*FIRST_NAME\s*\}\}/g, first);
}

/** Returns a reason to block the send, or null if the body is safe. */
export function unsafeBodyReason(body: string, subject: string): string | null {
  for (const bad of ["{{", "[NAME]", "[REDACTED]"]) {
    if (body.includes(bad) || subject.includes(bad)) return `Email still contains "${bad}". Edit the draft before sending.`;
  }
  return null;
}
