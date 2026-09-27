/**
 * Public game and training surfaces.
 *
 * `/play/` and `/training/` deliberately reuse one browser game bundle. It contains
 * combat content and local UI, but no credentials or privileged server capability.
 * Developer mode is allowed only after the Worker verifies the operator session.
 */
import type { Env } from "../env";
import { credentialsConfigured } from "../auth/credentials";
import { verifySessionCookie } from "../auth/session";

const LAB_DOCUMENT = "/lab/index.html";
async function asset(env: Env, url: URL, path: string): Promise<Response> {
  return env.ASSETS.fetch(new Request(new URL(path, url.origin), { method: "GET" }));
}

export async function handlePlay(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed\n", {
      status: 405,
      headers: { allow: "GET, HEAD", "content-type": "text/plain; charset=utf-8" },
    });
  }

  const routePrefix = "/play";
  const assetPrefix = `${routePrefix}/assets/`;
  const lastSegment = url.pathname.slice(url.pathname.lastIndexOf("/") + 1);
  const wantsFile = lastSegment.includes(".");
  if (wantsFile && !url.pathname.startsWith(assetPrefix)) {
    return new Response(`Not found: ${url.pathname}\n`, {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const assetPath = wantsFile ? url.pathname.replace(new RegExp(`^${routePrefix}/`), "/lab/") : LAB_DOCUMENT;
  const upstream = await asset(env, url, assetPath);
  if (upstream.status === 404) {
    return new Response(wantsFile ? `Not found: ${url.pathname}\n` : "The game bundle is unavailable.\n", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const headers = new Headers(upstream.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "no-referrer");
  headers.set("cache-control", wantsFile ? "public, max-age=31536000, immutable" : "no-store");

  if (request.method === "HEAD") return new Response(null, { status: upstream.status, headers });
  if (wantsFile) return new Response(upstream.body, { status: upstream.status, headers });

  const html = (await upstream.text()).replaceAll('"/lab/assets/', `"${routePrefix}/assets/`);
  headers.delete("content-length");
  return new Response(html, { status: upstream.status, headers });
}

export async function handleTraining(request: Request, env: Env, url: URL): Promise<Response> {
  if (url.searchParams.get("debug") === "1") {
    const session = credentialsConfigured(env)
      ? await verifySessionCookie(env, request.headers.get("cookie"))
      : null;
    if (!session) {
      const safe = new URL(url);
      safe.searchParams.delete("debug");
      safe.searchParams.set("mode", "training");
      return new Response(null, {
        status: 302,
        headers: { location: `${safe.pathname}${safe.search}`, "cache-control": "no-store" },
      });
    }
  }
  return handlePlay(request, env, url);
}
