// Minimal email/password session auth for the MVP.
// Uses Web Crypto (HMAC-SHA256) so the same code runs in Node route handlers
// and the Edge middleware. If ADMIN_EMAIL/ADMIN_PASSWORD are not set, auth is
// disabled and the dashboard is open (local development convenience). When
// they ARE set, AUTH_SECRET is required — there is deliberately no fallback
// secret, otherwise anyone could forge session cookies.

export const SESSION_COOKIE = "dlg_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET must be set when ADMIN_EMAIL/ADMIN_PASSWORD are configured."
    );
  }
  return secret;
}

export function authEnabled(): boolean {
  return Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD);
}

/** Auth is enabled but cannot operate safely (no signing secret). */
export function authMisconfigured(): boolean {
  return authEnabled() && !process.env.AUTH_SECRET;
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  const b64 = typeof btoa !== "undefined" ? btoa(binary) : Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacWithKey(key: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(payload));
  return base64url(new Uint8Array(sig));
}

async function hmac(payload: string): Promise<string> {
  return hmacWithKey(getSecret(), payload);
}

/**
 * Constant-time-ish string comparison for secrets: HMAC both sides with a
 * fresh random key and compare the digests. The digests leak no positional
 * timing information about the underlying values, and Web Crypto is available
 * in both the Node and Edge runtimes (crypto.timingSafeEqual is Node-only).
 */
async function secureCompare(a: string, b: string): Promise<boolean> {
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  const key = base64url(keyBytes);
  const [da, db] = await Promise.all([
    hmacWithKey(key, a),
    hmacWithKey(key, b),
  ]);
  return da === db;
}

export async function checkCredentials(email: string, password: string): Promise<boolean> {
  if (!authEnabled() || authMisconfigured()) return false;
  const emailOk = await secureCompare(
    email.trim().toLowerCase(),
    String(process.env.ADMIN_EMAIL).trim().toLowerCase()
  );
  const passwordOk = await secureCompare(password, String(process.env.ADMIN_PASSWORD));
  return emailOk && passwordOk;
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
  if (authMisconfigured()) return null; // fail closed: no secret, no sessions
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;
  const expected = await hmac(encoded);
  if (!(await secureCompare(sig, expected))) return null;
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
