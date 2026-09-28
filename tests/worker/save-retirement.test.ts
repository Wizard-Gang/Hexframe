import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import worker from "../../src/worker/index";
import type { Env } from "../../src/worker/env";

const root = fileURLToPath(new URL("../..", import.meta.url));

function environment(): Env {
  return {
    ENVIRONMENT: "test",
    ASSETS: {
      fetch: async () => new Response("Not found", { status: 404 }),
    } as unknown as Fetcher,
  };
}

function workerSources(path = join(root, "src/worker")): string {
  return readdirSync(path, { withFileTypes: true })
    .flatMap((entry) => {
      const full = join(path, entry.name);
      if (entry.isDirectory()) return workerSources(full);
      return entry.name.endsWith(".ts") ? [readFileSync(full, "utf8")] : [];
    })
    .join("\n");
}

describe("HF-154 save retirement", () => {
  it.each([
    "/api/save",
    "/api/save/retired",
  ])("returns the generic JSON API 404 for %s", async (pathname) => {
    const response = await worker.fetch(new Request(`https://hexframe.test${pathname}`), environment());
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({ error: "not_found" });
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("removes save bindings, identity, modules and Worker-side combat imports", () => {
    const source = workerSources();
    expect(source).not.toMatch(/PLAYER_SAVES|hf_player|player-save|routes\/api-save/);
    expect(source).not.toMatch(/from\s+["'][^"']*(?:\/combat\/|\/content\/|\/player\/)/);

    for (const path of [
      "src/worker/player-identity.ts",
      "src/worker/player-save-object.ts",
      "src/worker/routes/api-save.ts",
      "src/player/client.ts",
      "src/player/save.ts",
      "src/lab/build-state.ts",
      "src/content/armor.ts",
    ]) {
      expect(existsSync(join(root, path))).toBe(false);
    }

    const wrangler = readFileSync(join(root, "wrangler.jsonc"), "utf8");
    expect(wrangler).not.toContain('"PLAYER_SAVES"');
    expect(wrangler).toContain('"deleted_classes": ["PlayerSaveObject"]');
  });

  it("keeps Training on the fixed authored kit and device-local preferences/tutorial progress", () => {
    const app = readFileSync(join(root, "src/lab/app.ts"), "utf8");
    expect(app).toContain("createTestFighter()");
    expect(app).not.toMatch(/loadPlayerSave|buildStateFromPlayerSave|testFighterWithBuild/);

    const preferences = readFileSync(join(root, "src/lab/preferences.ts"), "utf8");
    const tutorial = readFileSync(join(root, "src/lab/tutorial.ts"), "utf8");
    expect(preferences).toMatch(/localStorage\.getItem\(STORAGE_KEY\)/);
    expect(preferences).toMatch(/localStorage\.setItem\(STORAGE_KEY/);
    expect(tutorial).toMatch(/localStorage\.getItem\(STORAGE_KEY\)/);
    expect(tutorial).toMatch(/localStorage\.setItem\(STORAGE_KEY/);
  });
});
