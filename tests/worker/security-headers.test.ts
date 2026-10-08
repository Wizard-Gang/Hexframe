import { describe, expect, it } from "vitest";

import type { Env } from "../../src/worker/env";
import worker from "../../src/worker/index";

function environment(): Env {
  const assets = {
    fetch: async (input: Request): Promise<Response> => {
      const path = new URL(input.url).pathname;
      if (path === "/play/index.html") {
        return new Response('<script type="module" src="/play/assets/main.js"></script>', {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      if (path === "/play/assets/main.js") {
        return new Response("export {};", { headers: { "content-type": "text/javascript" } });
      }
      return new Response("missing", { status: 404 });
    },
  } as unknown as Fetcher;
  return { WG_APP: "hexframe", ASSETS: assets };
}

describe("worker response hardening", () => {
  it.each(["/", "/missing"])(
    "adds shared transport, framing, and capability restrictions to %s",
    async (path) => {
      const response = await worker.fetch(
        new Request(`https://hexframe.wizardgang.ai${path}`),
        environment(),
        {},
      );

      expect(response.headers.get("strict-transport-security")).toBe(
        "max-age=31536000; includeSubDomains",
      );
      expect(response.headers.get("x-frame-options")).toBe("DENY");
      expect(response.headers.get("permissions-policy")).toBe(
        "camera=(), microphone=(), geolocation=()",
      );
    },
  );

  it("preserves the Training application CSP behind the shared shell", async () => {
    const response = await worker.fetch(
      new Request("https://hexframe.wizardgang.ai/play/"),
      environment(),
      {},
    );
    expect(response.status).toBe(200);
    const policy = response.headers.get("content-security-policy") ?? "";
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("script-src 'self' https://static.cloudflareinsights.com");
    expect(policy).toContain("style-src 'self'");
    expect(policy).not.toContain("'unsafe-inline'");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });

  it("uses the shell CSP for the generic JSON API 404 boundary", async () => {
    const response = await worker.fetch(
      new Request("https://hexframe.wizardgang.ai/api/retired", {
        headers: { accept: "application/json" },
      }),
      environment(),
      {},
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });
});
