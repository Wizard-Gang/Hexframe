/**
 * The Hexframe Worker.
 *
 * Every deployed request passes through this router before Workers Static Assets. The
 * Worker owns only public document routing, the canonical Training redirect, the JSON API
 * 404 boundary, and response hardening. Combat and Training state remain in the browser.
 */
import type { Env } from "./env";
import { handleTraining } from "./routes/play";

const APP_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' https://static.cloudflareinsights.com",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self' https://cloudflareinsights.com",
  "font-src 'self'",
].join("; ");

function harden(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  headers.set("x-frame-options", "DENY");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  if (!headers.has("referrer-policy")) headers.set("referrer-policy", "no-referrer");
  if (!headers.has("content-security-policy")) {
    headers.set("content-security-policy", APP_CONTENT_SECURITY_POLICY);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function notFound(pathname: string): Response {
  return new Response(`Not found: ${pathname}\n`, {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

function apiNotFound(): Response {
  return new Response(JSON.stringify({ error: "not_found" }), {
    status: 404,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function redirect(location: string, status = 308): Response {
  return new Response(null, {
    status,
    headers: { location, "cache-control": "no-store" },
  });
}

async function passThrough(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed\n", {
      status: 405,
      headers: { allow: "GET, HEAD", "content-type": "text/plain; charset=utf-8" },
    });
  }

  const upstream = await env.ASSETS.fetch(new Request(url.toString(), { method: "GET" }));
  if (upstream.status === 404) return notFound(url.pathname);

  return new Response(request.method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: new Headers(upstream.headers),
  });
}

async function route(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname;

  if (path === "/") {
    return passThrough(request, env, new URL("/index.html", url));
  }

  if (path === "/play") {
    return redirect(url.searchParams.get("tutorial") === "1" ? "/play/?tutorial=1" : "/play/");
  }
  if (path.startsWith("/play/")) return handleTraining(request, env, url);

  if (path === "/api" || path.startsWith("/api/")) return apiNotFound();

  return passThrough(request, env, url);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      return harden(await route(request, env, url));
    } catch (error) {
      console.error("worker.error", url.pathname, error);
      return harden(
        new Response("Internal error\n", {
          status: 500,
          headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
        }),
      );
    }
  },
} satisfies ExportedHandler<Env>;
