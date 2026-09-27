import { describe, expect, it } from "vitest";

import type { Env } from "../../src/worker/env";
import worker from "../../src/worker/index";
import { handlePlay, handleTraining } from "../../src/worker/routes/play";

function environment(paths: string[]): Env {
  const assets = {
    fetch: async (input: Request): Promise<Response> => {
      const path = new URL(input.url).pathname;
      paths.push(path);
      if (path === "/lab/index.html") {
        return new Response('<script src="/lab/assets/game.js"></script><link href="/lab/assets/game.css">', {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      if (path === "/index.html") {
        return new Response("<main><h1>Hexframe</h1><a href=\"/play/\">Open training</a></main>", {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      if (path === "/lab/assets/game.js") {
        return new Response("export {};", { headers: { "content-type": "text/javascript" } });
      }
      return new Response("missing", { status: 404 });
    },
  } as unknown as Fetcher;
  return { ASSETS: assets, ENVIRONMENT: "test" };
}

describe("public playtest route", () => {
  it("serves the combat document without credentials and rewrites its gated assets", async () => {
    const paths: string[] = [];
    const url = new URL("https://hexframe.test/play/");
    const response = await handlePlay(new Request(url), environment(paths), url);

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('src="/play/assets/game.js"');
    expect(paths).toEqual(["/lab/index.html"]);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("maps public hashed assets to the built lab bundle", async () => {
    const paths: string[] = [];
    const url = new URL("https://hexframe.test/play/assets/game.js");
    const response = await handlePlay(new Request(url), environment(paths), url);

    expect(response.status).toBe(200);
    expect(paths).toEqual(["/lab/assets/game.js"]);
    expect(response.headers.get("cache-control")).toContain("immutable");
  });

  it("serves the training bundle through the canonical play route", async () => {
    const paths: string[] = [];
    const url = new URL("https://hexframe.test/play/?mode=training");
    const response = await handleTraining(new Request(url), environment(paths), url);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('src="/play/assets/game.js"');
  });

  it("strips unauthenticated developer tools without rendering redirect text", async () => {
    const url = new URL("https://hexframe.test/play/?mode=training&debug=1");
    const response = await handleTraining(new Request(url), environment([]), url);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/play/?mode=training");
    expect(await response.text()).toBe("");
  });

  it("remains read-only at the HTTP boundary", async () => {
    const url = new URL("https://hexframe.test/play/");
    const response = await handlePlay(new Request(url, { method: "POST" }), environment([]), url);
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, HEAD");
  });

  it("serves a public project overview at the root", async () => {
    const paths: string[] = [];
    const response = await worker.fetch(new Request("https://hexframe.test/"), environment(paths));
    expect(response.status).toBe(200);
    expect(paths).toEqual(["/index.html"]);
    expect(await response.text()).toContain("Open training");
  });

  it.each(["/codex/", "/codex/moves/3/"])(
    "routes the protected developer surface at %s through operator sign in",
    async (pathname) => {
      const response = await worker.fetch(new Request(`https://hexframe.test${pathname}`), environment([]));
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toContain("/login?next=");
      expect(await response.text()).toBe("");
    },
  );

  it("keeps the canonical /play slash redirect", async () => {
    const response = await worker.fetch(new Request("https://hexframe.test/play"), environment([]));
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("/play/");
  });

  it.each(["/training", "/campaign", "/fight", "/loadouts", "/forge", "/settings"])(
    "returns 404 for retired route %s",
    async (pathname) => {
      const paths: string[] = [];
      const response = await worker.fetch(new Request(`https://hexframe.test${pathname}`), environment(paths));
      expect(response.status).toBe(404);
      expect(paths).toEqual([pathname]);
    },
  );
});
