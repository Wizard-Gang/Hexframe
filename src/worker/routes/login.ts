/**
 * The login form and the two endpoints behind it.
 *
 * The page is rendered here rather than built as a static asset so that it cannot pick up
 * a stylesheet, a script or an analytics tag by accident: a credential form should have
 * exactly one job and no third-party surface at all. It is plain semantic HTML with no
 * stylesheet and no JavaScript.
 */
import type { Env } from "../env";
import { missingCredentialBindings } from "../env";
import { checkCredentials, credentialsConfigured } from "../auth/credentials";
import { clearSessionCookie, createSessionCookie, SESSION_TTL_SECONDS } from "../auth/session";

/** The destination when `next` is absent or fails the same-origin test. */
export const DEFAULT_NEXT = "/lab";

/** A login body is a username and a password; anything larger is not one. */
const MAX_LOGIN_BODY_BYTES = 4096;

const LOGIN_ATTEMPT_WINDOW_MS = 60_000;
const LOGIN_ATTEMPT_LIMIT = 8;

/**
 * A per-isolate attempt counter.
 *
 * Be clear about what this is: an isolate-local limiter is a speed bump, not a control.
 * Cloudflare runs many isolates, they come and go, and a determined attacker spreads
 * their guesses across them and never meets the same counter twice. It exists to stop a
 * script hammering one connection, and nothing more. The real limiter arrives with the
 * `MatchRoom` Durable Object work, where a single object can hold the count for everyone.
 */
const loginAttempts = new Map<string, { windowStart: number; count: number }>();

/** Keeps a hostile spread of source addresses from growing the map without bound. */
const LOGIN_ATTEMPT_MAX_KEYS = 512;

function attemptKey(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ?? "unknown";
}

function rateLimited(key: string, now: number): boolean {
  const entry = loginAttempts.get(key);
  if (!entry || now - entry.windowStart >= LOGIN_ATTEMPT_WINDOW_MS) return false;
  return entry.count >= LOGIN_ATTEMPT_LIMIT;
}

function recordAttempt(key: string, now: number): void {
  const entry = loginAttempts.get(key);
  if (!entry || now - entry.windowStart >= LOGIN_ATTEMPT_WINDOW_MS) {
    if (loginAttempts.size >= LOGIN_ATTEMPT_MAX_KEYS) loginAttempts.clear();
    loginAttempts.set(key, { windowStart: now, count: 1 });
    return;
  }
  entry.count += 1;
}

function clearAttempts(key: string): void {
  loginAttempts.delete(key);
}

/**
 * Reduce a submitted `next` to something that can only point back at this origin.
 *
 * An open redirect on a login form is a real hole — it lets a phishing link send a
 * freshly authenticated operator somewhere else — so this is an allow-list, not a
 * blocklist. A single leading slash and no backslashes or control characters means the
 * browser must resolve it against this origin; `//evil.example` is protocol-relative and
 * is exactly what the double-slash test rejects.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 512) return DEFAULT_NEXT;
  if (raw[0] !== "/") return DEFAULT_NEXT;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return DEFAULT_NEXT;
  if (/[\x00-\x1f\x7f\\]/.test(raw)) return DEFAULT_NEXT;
  return raw;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function authHeaders(contentType: string): Headers {
  return new Headers({
    "content-type": contentType,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "x-robots-tag": "noindex, nofollow",
    "content-security-policy":
      "default-src 'none'; style-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  });
}

export function credentialsUnavailable(env: Env): Response {
  const missing = missingCredentialBindings(env);
  const list = missing.join(", ");
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Unavailable</title></head><body><h1>503 — developer tools unavailable</h1><p>Missing Worker binding: ${escapeHtml(list)}.</p><p>Set it with <code>wrangler secret put</code>, or in <code>.dev.vars</code> for local development.</p></body></html>`;
  const headers = authHeaders("text/html; charset=utf-8");
  headers.set("retry-after", "60");
  return new Response(body, { status: 503, headers });
}

export function loginPage(error: string | null, next: string): Response {
  const safeNext = safeNextPath(next);
  const status = error === null ? 200 : 401;
  const errorBlock = error === null ? "" : `<p class="error" role="alert">${escapeHtml(error)}</p>`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="robots" content="noindex, nofollow">
<title>Hexframe — developer tools sign in</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2032%2032%22%3E%3Crect%20width%3D%2232%22%20height%3D%2232%22%20fill%3D%22%2308080b%22%2F%3E%3Crect%20x%3D%225%22%20y%3D%2215%22%20width%3D%2212%22%20height%3D%2212%22%20fill%3D%22%23d9ff43%22%2F%3E%3Crect%20x%3D%2215%22%20y%3D%225%22%20width%3D%2212%22%20height%3D%2212%22%20fill%3D%22%23a489ff%22%2F%3E%3C%2Fsvg%3E">
</head>
<body>
<main>
  <h1>Hexframe</h1>
  <p class="lede">Advanced Training developer tools are private. Access is restricted to the project operator.</p>
  ${errorBlock}
  <form method="post" action="/login" autocomplete="off">
    <input type="hidden" name="next" value="${escapeHtml(safeNext)}">
    <label>Username
      <input type="text" name="username" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required>
    </label>
    <label>Password
      <input type="password" name="password" autocomplete="current-password" required>
    </label>
    <button type="submit">Sign in</button>
  </form>
  <footer>Sessions last 12 hours and are held in a signed, HttpOnly cookie.</footer>
</main>
</body>
</html>`;

  return new Response(html, { status, headers: authHeaders("text/html; charset=utf-8") });
}

function redirect(location: string, cookie: string | null): Response {
  const headers = authHeaders("text/plain; charset=utf-8");
  headers.set("location", location);
  if (cookie) headers.append("set-cookie", cookie);
  // 303 rather than 302: the browser must follow a POST with a GET, so a refresh on the
  // destination never re-submits the credential. Redirects intentionally carry no body.
  return new Response(null, { status: 303, headers });
}

export async function handleLogin(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "GET" || request.method === "HEAD") {
    if (!credentialsConfigured(env)) return credentialsUnavailable(env);
    return loginPage(null, safeNextPath(url.searchParams.get("next")));
  }

  if (request.method !== "POST") {
    const headers = authHeaders("text/plain; charset=utf-8");
    headers.set("allow", "GET, HEAD, POST");
    return new Response("Method not allowed\n", { status: 405, headers });
  }

  if (!credentialsConfigured(env)) return credentialsUnavailable(env);

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_LOGIN_BODY_BYTES) {
    return loginPage("That request was too large.", DEFAULT_NEXT);
  }

  const key = attemptKey(request);
  const now = Date.now();
  if (rateLimited(key, now)) {
    const response = loginPage("Too many attempts. Wait a minute and try again.", DEFAULT_NEXT);
    const headers = new Headers(response.headers);
    headers.set("retry-after", "60");
    return new Response(response.body, { status: 429, headers });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    recordAttempt(key, now);
    return loginPage("That form could not be read.", DEFAULT_NEXT);
  }

  const next = safeNextPath(readField(form, "next"));
  const username = readField(form, "username") ?? "";
  const password = readField(form, "password") ?? "";

  if (!checkCredentials(env, username, password)) {
    recordAttempt(key, now);
    return loginPage("Those credentials were not accepted.", next);
  }

  clearAttempts(key);
  const cookie = await createSessionCookie(env, username, SESSION_TTL_SECONDS, url);
  return redirect(next, cookie);
}

function readField(form: FormData, name: string): string | null {
  const value = form.get(name);
  return typeof value === "string" ? value : null;
}

export function handleLogout(url?: URL): Response {
  return redirect("/login", clearSessionCookie(url));
}
