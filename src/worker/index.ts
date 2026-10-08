import { createEdge } from "#wg-edge";
import type { Release } from "#wg-edge";
import type { Env } from "./env";
import { version, commit } from "./release.generated";
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

function redirect(location: string): Response {
  return new Response(null, {
    status: 308,
    headers: { location, "cache-control": "no-store" },
  });
}

function withApplicationCsp(response: Response): Response {
  const secured = new Response(response.body, response);
  if (!secured.headers.has("content-security-policy")) {
    secured.headers.set("content-security-policy", APP_CONTENT_SECURITY_POLICY);
  }
  return secured;
}

export function createHexframeWorker(release: Release) {
  return createEdge<Env>({
    release,
    async fetch(request, env, _ctx, edge) {
      const { url } = edge;
      if (url.pathname === "/") return redirect("/play/");
      if (url.pathname === "/play") {
        return redirect(url.searchParams.get("tutorial") === "1" ? "/play/?tutorial=1" : "/play/");
      }
      if (url.pathname.startsWith("/play/")) {
        return withApplicationCsp(await handleTraining(request, env, url));
      }
      return null;
    },
  });
}

export default createHexframeWorker({ version, commit });
