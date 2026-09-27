/**
 * The Worker's bindings.
 *
 * The three `ADMIN_*` values are optional in the type but not in behaviour: they arrive
 * as Cloudflare secrets in production and from `.dev.vars` locally, and a Worker whose
 * secrets were never uploaded would otherwise fail with a runtime `undefined` deep inside
 * the crypto code. Typing them as optional forces every reader to decide what to do about
 * an absent one, and the decision this project makes everywhere is: answer 503, name the
 * binding, and never fall open.
 */
export interface Env {
  ASSETS: Fetcher;
  ENVIRONMENT: string;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_SESSION_SECRET?: string;
}

/** The bindings a protected route cannot work without, in the order they are reported. */
export const REQUIRED_CREDENTIAL_BINDINGS = [
  "ADMIN_USERNAME",
  "ADMIN_PASSWORD",
  "ADMIN_SESSION_SECRET",
] as const;

export type CredentialBinding = (typeof REQUIRED_CREDENTIAL_BINDINGS)[number];

/**
 * Which credential bindings are absent or empty.
 *
 * An empty string counts as absent. `wrangler dev` happily loads `ADMIN_PASSWORD=` from
 * a half-filled `.dev.vars`, and an empty password that authenticated would be far worse
 * than a 503.
 */
export function missingCredentialBindings(env: Env): CredentialBinding[] {
  const missing: CredentialBinding[] = [];
  for (const name of REQUIRED_CREDENTIAL_BINDINGS) {
    const value = env[name];
    if (typeof value !== "string" || value.length === 0) missing.push(name);
  }
  return missing;
}
