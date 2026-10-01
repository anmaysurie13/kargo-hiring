// Simple password gate: the session cookie holds HMAC(DASHBOARD_PASSWORD, label). Web Crypto only, so
// it runs in proxy.ts and in route handlers alike.
export const SESSION_COOKIE = "kargo_session";

/** Password protection is ON only when DASHBOARD_PASSWORD is set. Unset = the dashboard is open to anyone with the link. */
export const authEnabled = () => Boolean(process.env.DASHBOARD_PASSWORD);

export async function sessionToken(password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("kargo-hiring-session-v1"));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function isValidSession(cookieValue: string | undefined): Promise<boolean> {
  const pw = process.env.DASHBOARD_PASSWORD;
  if (!pw || !cookieValue) return false;
  return safeEqual(cookieValue, await sessionToken(pw));
}
