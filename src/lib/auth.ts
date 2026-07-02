// Minimal email/password session auth for the MVP.
// Uses Web Crypto (HMAC-SHA256) so the same code runs in Node route handlers
// and the Edge middleware. If ADMIN_EMAIL/ADMIN_PASSWORD are not set, auth is
// disabled and the dashboard is open (local development convenience).

export const SESSION_COOKIE = "dlg_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function getSecret(): string {
  return process.env.AUTH_SECRET || "dev-insecure-secret-change-me";
}

export function authEnabled(): boolean {
  return Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD);
}

export function checkCredentials(email: string, password: string): boolean {
  if (!authEnabled()) return false;
  return (
    email.trim().toLowerCase() === String(process.env.ADMIN_EMAIL).trim().toLowerCase() &&
    password === process.env.ADMIN_PASSWORD
  );
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  const b64 = typeof btoa !== "undefined" ? btoa(binary) : Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return base64url(new Uint8Array(sig));
}

/** Create a signed session token: base64url(payload).signature */
export async function createSessionToken(email: string): Promise<string> {
  const payload = JSON.stringify({ email, exp: Date.now() + SESSION_TTL_MS });
  const encoded = base64url(new TextEncoder().encode(payload));
  const sig = await hmac(encoded);
  return `${encoded}.${sig}`;
}

/** Verify a session token; returns the email when valid, null otherwise. */
export async function verifySessionToken(token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;
  const expected = await hmac(encoded);
  if (sig !== expected) return null;
  try {
    const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const json =
      typeof atob !== "undefined"
        ? decodeURIComponent(
            Array.from(atob(b64))
              .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
              .join("")
          )
        : Buffer.from(b64, "base64").toString("utf8");
    const payload = JSON.parse(json) as { email: string; exp: number };
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload.email ?? null;
  } catch {
    return null;
  }
}
