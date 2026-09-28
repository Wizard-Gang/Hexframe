/**
 * Public Training surface.
 *
 * /play/ is a first-class build output. The Worker no longer rewrites the private lab
 * document or its asset paths, and Training has no query-string capability gate.
 */
import type { Env } from "../env";

const PLAY_DOCUMENT = "/play/index.html";

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

  const isDocument = url.pathname === "/play/";
  const isAsset = url.pathname.startsWith("/play/assets/");
  if (isDocument && url.search) {
    return new Response(null, { status: 308, headers: { location: "/play/", "cache-control": "no-store" } });
  }
  if (!isDocument && !isAsset) {
    return new Response(`Not found: ${url.pathname}\n`, {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const upstream = await asset(env, url, isDocument ? PLAY_DOCUMENT : url.pathname);
  if (upstream.status === 404) {
    return new Response(isDocument ? "The game bundle is unavailable.\n" : `Not found: ${url.pathname}\n`, {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const headers = new Headers(upstream.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "no-referrer");
  headers.set("cache-control", isAsset ? "public, max-age=31536000, immutable" : "no-store");

  return new Response(request.method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

export const handleTraining = handlePlay;
