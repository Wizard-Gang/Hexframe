/**
 * Authenticated legacy developer entry retained until HF-159.
 *
 * Authentication remains in place, but the separate developer Training layout no longer
 * exists. A verified operator lands on the same public /play/ Training screen.
 */
import type { Env } from "../env";
import { credentialsConfigured } from "../auth/credentials";
import { verifySessionCookie } from "../auth/session";

function redirect(location: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      location,
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

export async function handleLab(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed\n", {
      status: 405,
      headers: { allow: "GET, HEAD", "content-type": "text/plain; charset=utf-8" },
    });
  }

  const session = credentialsConfigured(env)
    ? await verifySessionCookie(env, request.headers.get("cookie"))
    : null;

  if (!session) {
    const next = `${url.pathname}${url.search}`;
    return redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  return redirect("/play/");
}
