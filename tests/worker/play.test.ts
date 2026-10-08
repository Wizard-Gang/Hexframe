import { describe, expect, it } from "vitest";

import type { Env } from "../../src/worker/env";
import worker from "../../src/worker/index";
import { handlePlay, handleTraining } from "../../src/worker/routes/play";

function environment(paths: string[]): Env {
  const assets = {
    fetch: async (input: Request): Promise<Response> => {
      const path = new URL(input.url).pathname;
      paths.push(path);
      if (path === "/play/index.html") return new Response('<script src="/play/assets/game.js"></script><link href="/play/assets/game.css">', { headers: { "content-type": "text/html; charset=utf-8" } });
      if (path === "/play/assets/game.js") return new Response("export {};", { headers: { "content-type": "text/javascript" } });
      return new Response("missing", { status: 404 });
    },
  } as unknown as Fetcher;
  return { WG_APP: "hexframe", ASSETS: assets };
}

describe("public Training route", () => {
  it("serves the first-class play document directly with no query requirement", async () => {
    const paths: string[] = []; const url = new URL("https://hexframe.test/play/");
    const response = await handleTraining(new Request(url), environment(paths), url);
    expect(response.status).toBe(200); expect(await response.text()).toContain('src="/play/assets/game.js"');
    expect(paths).toEqual(["/play/index.html"]); expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("preserves the tutorial entry query while canonicalizing retired flags", async () => {
    const tutorialPaths: string[] = []; const tutorialUrl = new URL("https://hexframe.test/play/?tutorial=1");
    const tutorialResponse = await handleTraining(new Request(tutorialUrl), environment(tutorialPaths), tutorialUrl);
    expect(tutorialResponse.status).toBe(200);
    expect(tutorialPaths).toEqual(["/play/index.html"]);

    for (const search of ["?mode=training", "?debug=1", "?mode=other&debug=1"]) {
      const paths: string[] = []; const url = new URL(`https://hexframe.test/play/${search}`);
      const response = await handleTraining(new Request(url), environment(paths), url);
      expect(response.status).toBe(308);
      expect(response.headers.get("location")).toBe("/play/");
      expect(paths).toEqual([]);
    }

    const mixedPaths: string[] = []; const mixedUrl = new URL("https://hexframe.test/play/?debug=1&tutorial=1");
    const mixedResponse = await handleTraining(new Request(mixedUrl), environment(mixedPaths), mixedUrl);
    expect(mixedResponse.status).toBe(308);
    expect(mixedResponse.headers.get("location")).toBe("/play/?tutorial=1");
    expect(mixedPaths).toEqual([]);
  });

  it("serves play assets without lab-path rewriting", async () => {
    const paths: string[] = []; const url = new URL("https://hexframe.test/play/assets/game.js");
    const response = await handlePlay(new Request(url), environment(paths), url);
    expect(response.status).toBe(200); expect(paths).toEqual(["/play/assets/game.js"]); expect(response.headers.get("cache-control")).toContain("immutable");
  });

  it("remains read-only at the HTTP boundary", async () => {
    const url = new URL("https://hexframe.test/play/");
    const response = await handlePlay(new Request(url, { method: "POST" }), environment([]), url);
    expect(response.status).toBe(405); expect(response.headers.get("allow")).toBe("GET, HEAD");
  });

  it("redirects the public root to Training", async () => {
    const paths: string[] = [];
    const response = await worker.fetch(new Request("https://hexframe.wizardgang.ai/"), environment(paths), {});
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("/play/");
    expect(paths).toEqual([]);
  });

  it("keeps the canonical /play slash redirect and preserves tutorial entry", async () => {
    const retired = await worker.fetch(new Request("https://hexframe.wizardgang.ai/play?debug=1"), environment([]), {});
    expect(retired.status).toBe(308); expect(retired.headers.get("location")).toBe("/play/");
    const tutorial = await worker.fetch(new Request("https://hexframe.wizardgang.ai/play?tutorial=1"), environment([]), {});
    expect(tutorial.status).toBe(308); expect(tutorial.headers.get("location")).toBe("/play/?tutorial=1");
  });

  it.each(["/training", "/fight", "/forge", "/settings"])("returns shell 404 for retired route %s", async (pathname) => {
    const paths: string[] = [];
    const response = await worker.fetch(new Request(`https://hexframe.wizardgang.ai${pathname}`), environment(paths), {});
    expect(response.status).toBe(404);
    expect(paths).toEqual([]);
  });
});
