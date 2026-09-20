import { describe, expect, it } from "vitest";

import type { Env } from "../../src/worker/env";
import worker from "../../src/worker/index";

function environment(): Env {
  const assets = {
    fetch: async (input: Request): Promise<Response> => {
      const path = new URL(input.url).pathname;
      if (path === "/index.html") {
        return new Response('<script type="module" src="/assets/main.js"></script>', {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      if (path === "/assets/main.js") {
        return new Response("export {};", { headers: { "content-type": "text/javascript" } });
      }
      return new Response("missing", { status: 404 });
    },
  } as unknown as Fetcher;
  return { ASSETS: assets, ENVIRONMENT: "test" };
}

describe("worker response hardening", () => {
  it.each(["/", "/assets/main.js", "/missing"])(
    "adds transport, framing, capability, and content restrictions to %s",
    async (path) => {
      const response = await worker.fetch(
        new Request(`https://hexframe.test${path}`),
        environment(),
      );

      expect(response.headers.get("strict-transport-security")).toBe(
        "max-age=31536000; includeSubDomains",
      );
      expect(response.headers.get("x-frame-options")).toBe("DENY");
      expect(response.headers.get("permissions-policy")).toBe(
        "camera=(), microphone=(), geolocation=()",
      );
      expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
      expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
      const policy = response.headers.get("content-security-policy") ?? "";
      expect(policy).toContain(
        "script-src 'self' https://static.cloudflareinsights.com",
      );
      expect(policy).toContain("style-src 'self'");
      expect(policy).not.toContain("'unsafe-inline'");
    },
  );

  it("preserves the login page's stricter route-specific policy", async () => {
    const response = await worker.fetch(
      new Request("https://hexframe.test/login"),
      environment(),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
    const policy = response.headers.get("content-security-policy") ?? "";
    expect(policy).not.toContain("static.cloudflareinsights.com");
    expect(policy).toContain("style-src 'none'");
    expect(policy).not.toContain("'unsafe-inline'");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });
});
