// Deterministic PII extraction and redaction. NO AI here: the raw CV text is exactly
// what we are protecting, so it never leaves this process before being stripped.

export type ExtractedPII = {
  fullName: string | null;
  email: string | null;
  phone: string | null;
};

export type RedactionReport = {
  name: number;
  email: number;
  phone: number;
  url: number;
  nameSource: "csv" | "heading" | "near_email" | "filename" | "none";
};

export const REDACTED = "[REDACTED]";

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi;

// Indian mobiles in common shapes: +91 98204 37810, +91-9820437810, (+91) 98204-37810,
// 098204-37810, 91 98204 37810, 9820437810, 982-043-7810.
const MOBILE_RE = /(?<![\d+])(?:(?:\+|00)\s*91[\s.\-]*|\(\s*\+?\s*91\s*\)[\s.\-]*|91[\s.\-]+|0)?[6-9](?:[\s.\-]?\d){9}(?!\d)/g;
// Landlines with an explicit prefix: +91 22 2345 6789, 022-23456789.
const LANDLINE_RE = /(?<![\d+])(?:(?:\+|00)\s*91[\s.\-]*|0)[1-9]\d{1,3}[\s.\-]+\d{3,4}[\s.\-]?\d{3,4}(?!\d)/g;

// Any URL, plus bare "domain.tld/path" links (linkedin.com/in/x, github.com/x, leetcode.com/x, portfolio.dev/x).
// Profile and portfolio links usually contain the candidate's name, and URLs carry no scoring evidence.
const URL_RE =
  /\b(?:https?:\/\/|www\.)[^\s<>()"']+|\b(?:[a-z0-9-]+\.)+(?:com|in|io|dev|me|co|org|net|ai|app|site|page|xyz|tech|so|ly|link|bio)\/[^\s<>()"']*/gi;

/** Handle-like tokens (usernames, paths, ids) that may embed a name: anything containing . / _ @, or letters followed by digits. */
const HANDLE_TOKEN_RE = /[^\s|·•,;()<>"']*[./_@][^\s|·•,;()<>"']*|\b[a-z]+[0-9]+[a-z0-9]*\b/gi;

const HEADER_WORDS = new Set([
  "curriculum", "vitae", "resume", "résumé", "cv", "profile", "summary", "contact", "personal",
  "details", "objective", "experience", "education", "skills", "product", "manager", "senior",
  "page", "about", "me", "work", "history", "professional",
]);

const FILENAME_NOISE = new Set(["cv", "resume", "pm", "spm", "final", "updated", "new", "copy", "v1", "v2", "v3", "draft", "senior", "product", "manager"]);

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** A line that plausibly is just a person's name: 2–4 alphabetic words, no header vocabulary. */
export function looksLikeName(line: string): boolean {
  const cleaned = line.replace(/^(name\s*[:\-]\s*)/i, "").trim();
  if (cleaned.length < 3 || cleaned.length > 50) return false;
  const words = cleaned.split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;
  return words.every((w) => {
    const bare = w.replace(/\.$/, "");
    if (HEADER_WORDS.has(bare.toLowerCase())) return false;
    // "Priya", "PRIYA", "D'Souza", "Ram-Kumar", "S." (initial)
    return /^\p{Lu}[\p{L}'\-]*$/u.test(bare) || /^\p{Lu}$/u.test(bare);
  });
}

function nameFromHeading(lines: string[]): string | null {
  for (const raw of lines.slice(0, 5)) {
    const line = raw.trim();
    if (!line) continue;
    // Headings sometimes carry contact details: "Priya Sharma | priya@x.com | +91 ..."
    const first = line.split(/\s*[|•·,]\s*|\s{3,}|\t/)[0].trim();
    if (looksLikeName(first)) return first.replace(/^(name\s*[:\-]\s*)/i, "").trim();
  }
  return null;
}

function nameNearEmail(lines: string[]): string | null {
  const idx = lines.findIndex((l) => new RegExp(EMAIL_RE.source, "i").test(l));
  if (idx === -1) return null;
  const sameLine = lines[idx].split(/\s*[|•·,:]\s*|\s{2,}|\t/).map((s) => s.trim());
  for (const part of sameLine) if (looksLikeName(part)) return part;
  for (const j of [idx - 1, idx - 2, idx + 1]) {
    const l = lines[j]?.trim();
    if (l && looksLikeName(l)) return l.replace(/^(name\s*[:\-]\s*)/i, "").trim();
  }
  return null;
}

/** cv_12_priya_sharma.pdf → "Priya Sharma" */
export function nameFromFilename(filename: string): string | null {
  const base = filename.replace(/^.*[\\/]/, "").replace(/\.[a-z0-9]+$/i, "");
  const tokens = base
    .split(/[_\-\s.]+/)
    .filter((t) => /^\p{L}+$/u.test(t) && t.length > 1 && !FILENAME_NOISE.has(t.toLowerCase()));
  if (tokens.length === 0) return null;
  return titleCase(tokens.slice(0, 3).join(" "));
}

function normalisePhone(raw: string): string {
  return raw.replace(/[^\d+]/g, "");
}

export function findEmails(text: string): string[] {
  return [...new Set(text.match(EMAIL_RE) ?? [])];
}

export function findPhones(text: string): string[] {
  // URLs and emails are removed first so digits inside them are not mistaken for phones.
  const scrubbed = text.replace(URL_RE, " ").replace(EMAIL_RE, " ");
  return [...new Set([...(scrubbed.match(MOBILE_RE) ?? []), ...(scrubbed.match(LANDLINE_RE) ?? [])].map((p) => p.trim()))];
}

export function extractPII(
  rawText: string,
  filename: string,
  provided: Partial<ExtractedPII> = {},
): { pii: ExtractedPII; nameSource: RedactionReport["nameSource"] } {
  const lines = rawText.split(/\r?\n/);
  let nameSource: RedactionReport["nameSource"] = "none";
  let fullName: string | null = provided.fullName?.trim() || null;
  if (fullName) nameSource = "csv";
  if (!fullName) {
    fullName = nameFromHeading(lines);
    if (fullName) nameSource = "heading";
  }
  if (!fullName) {
    fullName = nameNearEmail(lines);
    if (fullName) nameSource = "near_email";
  }
  if (!fullName) {
    fullName = nameFromFilename(filename);
    if (fullName) nameSource = "filename";
  }
  if (fullName && fullName === fullName.toUpperCase()) fullName = titleCase(fullName);

  const email = provided.email?.trim() || findEmails(rawText)[0] || null;
  const phone = provided.phone?.trim() || findPhones(rawText)[0] || null;
  return { pii: { fullName, email, phone }, nameSource };
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Full name first, then each part (≥2 letters) separately. */
export function nameTerms(fullName: string | null): string[] {
  if (!fullName) return [];
  const parts = fullName
    .split(/\s+/)
    .map((p) => p.replace(/[.,]/g, ""))
    .filter((p) => p.length >= 2);
  return [...new Set([fullName.trim(), ...parts])].sort((a, b) => b.length - a.length);
}

/** priyasharma / priya.sharma / priya_sharma / priya-sharma / psharma / sharmapriya, matched anywhere (no word boundary). */
function nameParts(fullName: string | null, min: number): string[] {
  return (fullName ?? "")
    .toLowerCase()
    .split(/\s+/)
    .map((p) => p.replace(/[^\p{L}]/gu, ""))
    .filter((p) => p.length >= min);
}

function joinedNameRegex(fullName: string | null): RegExp | null {
  const parts = nameParts(fullName, 2);
  if (parts.length < 2) return null;
  const first = parts[0];
  const last = parts[parts.length - 1];
  const variants = [`${first}[._-]?${last}`, `${last}[._-]?${first}`];
  if (last.length >= 4) variants.push(`(?<!\\p{L})${first[0]}[._-]?${last}`);
  return new RegExp(variants.join("|"), "giu");
}

/** Name parts long enough to search for inside handles/URLs without false positives. */
function handleParts(fullName: string | null): string[] {
  return nameParts(fullName, 4);
}

function nameRegex(term: string) {
  // Whole-word, case-insensitive, tolerant of any whitespace inside a multi-word name.
  const body = term.split(/\s+/).map(escapeRe).join("\\s+");
  return new RegExp(`(?<![\\p{L}])${body}(?![\\p{L}])`, "giu");
}

function phoneRegex(phone: string) {
  // Match the last 10 digits with any separators between them.
  const digits = phone.replace(/\D/g, "").slice(-10);
  if (digits.length < 8) return null;
  return new RegExp(digits.split("").join("[\\s.\\-()]*"), "g");
}

export function redact(
  rawText: string,
  pii: ExtractedPII,
  nameSource: RedactionReport["nameSource"],
): { content: string; report: RedactionReport } {
  const report: RedactionReport = { name: 0, email: 0, phone: 0, url: 0, nameSource };
  let text = rawText;

  text = text.replace(URL_RE, () => (report.url++, REDACTED));
  text = text.replace(EMAIL_RE, () => (report.email++, REDACTED));
  if (pii.email) text = text.replace(new RegExp(escapeRe(pii.email), "gi"), () => (report.email++, REDACTED));

  for (const re of [MOBILE_RE, LANDLINE_RE]) text = text.replace(re, () => (report.phone++, REDACTED));
  const pr = pii.phone ? phoneRegex(pii.phone) : null;
  if (pr) text = text.replace(pr, () => (report.phone++, REDACTED));

  for (const term of nameTerms(pii.fullName)) {
    text = text.replace(nameRegex(term), () => (report.name++, REDACTED));
  }
  // Joined forms (priyasharma, priya.sharma, priya_sharma, psharma) and handles that embed a name part.
  const joined = joinedNameRegex(pii.fullName);
  if (joined) text = text.replace(joined, () => (report.name++, REDACTED));
  const parts = handleParts(pii.fullName);
  if (parts.length)
    text = text.replace(HANDLE_TOKEN_RE, (tok) => (tok !== REDACTED && parts.some((p) => tok.toLowerCase().includes(p)) ? (report.name++, REDACTED) : tok));
  return { content: text, report };
}

export class PIILeakError extends Error {}

/** The privacy guarantee: throws if any stored PII survives in the stripped text. Run before every AI call. */
export function assertNoPII(content: string, pii: ExtractedPII): void {
  const leaks: string[] = [];
  for (const term of nameTerms(pii.fullName)) if (nameRegex(term).test(content)) leaks.push("name");
  const joined = joinedNameRegex(pii.fullName);
  if (joined && joined.test(content)) leaks.push("name");
  const parts = handleParts(pii.fullName);
  if (parts.length && (content.match(HANDLE_TOKEN_RE) ?? []).some((tok) => parts.some((p) => tok.toLowerCase().includes(p)))) leaks.push("name");
  if (pii.email && content.toLowerCase().includes(pii.email.toLowerCase())) leaks.push("email");
  if (findEmails(content).length) leaks.push("email");
  const pr = pii.phone ? phoneRegex(pii.phone) : null;
  if (pr && pr.test(content)) leaks.push("phone");
  if (leaks.length) throw new PIILeakError(`PII still present after redaction: ${[...new Set(leaks)].join(", ")}`);
}

/** Parse + separate in one step. */
export function separatePII(rawText: string, filename: string, provided: Partial<ExtractedPII> = {}) {
  const { pii, nameSource } = extractPII(rawText, filename, provided);
  const { content, report } = redact(rawText, pii, nameSource);
  assertNoPII(content, pii);
  return { pii, content, report };
}

export function firstNameOf(fullName: string | null | undefined): string | null {
  const first = fullName?.trim().split(/\s+/)[0];
  if (!first || first.length < 2) return null;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

export { normalisePhone };
