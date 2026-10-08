import { describe, expect, it } from "vitest";
import worker from "../src/worker/index";
import type { Env } from "../src/worker/env";
import { commit, version } from "../src/worker/release.generated";

function environment(): Env {
  return {
    WG_APP: "hexframe",
    ASSETS: {
      async fetch(input: RequestInfo | URL) {
        const request = input instanceof Request ? input : new Request(input);
        const path = new URL(request.url).pathname;
        if (path === "/play/index.html") {
          return new Response("<!doctype html><title>Hexframe Training</title>", {
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        }
        if (path.startsWith("/play/assets/")) {
          return new Response("export {};", {
            headers: { "content-type": "text/javascript; charset=utf-8" },
          });
        }
        return new Response("missing", { status: 404 });
      },
    } as Fetcher,
  };
}

describe("shared wg-edge boundary", () => {
  it("serves exact runtime identity from the shell", async () => {
    const response = await worker.fetch(new Request("https://hexframe.wizardgang.ai/version.json"), environment(), {});
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ app: "hexframe", version, commit });
  });

  it("redirects the root to Training", async () => {
    const response = await worker.fetch(new Request("https://hexframe.wizardgang.ai/"), environment(), {});
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("/play/");
  });

  it("serves Training through the app CSP", async () => {
    const response = await worker.fetch(new Request("https://hexframe.wizardgang.ai/play/"), environment(), {});
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Hexframe Training");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(response.headers.get("strict-transport-security")).toContain("max-age=31536000");
  });

  it("lets the shell own Accept-driven API 404s", async () => {
    const response = await worker.fetch(
      new Request("https://hexframe.wizardgang.ai/api/retired", { headers: { accept: "application/json" } }),
      environment(),
      {},
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    const body = await response.json() as { error: string; status: number };
    expect(body.error).toBe("Not found");
    expect(body.status).toBe(404);
  });
});
