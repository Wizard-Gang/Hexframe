import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import worker from "../../src/worker/index";
import type { Env } from "../../src/worker/env";

const root = fileURLToPath(new URL("../..", import.meta.url));

function environment(paths: string[] = []): Env {
  return {
    ENVIRONMENT: "test",
    ASSETS: {
      fetch: async (input: Request) => {
        paths.push(new URL(input.url).pathname);
        return new Response("missing", { status: 404 });
      },
    } as unknown as Fetcher,
  };
}

describe("HF-159 private developer surface retirement", () => {
  it.each([
    "/login",
    "/logout",
    "/lab",
    "/lab/",
    "/codex",
    "/codex/",
    "/codex/moves/3/",
  ])("returns the hardened static 404 for retired document route %s", async (pathname) => {
    const response = await worker.fetch(
      new Request(`https://hexframe.test${pathname}`),
      environment(),
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
  });

  it.each([
    "/api/lab",
    "/api/lab/session",
    "/api/lab/desync",
    "/api/lab/anything",
    "/api/anything",
  ])("returns the generic JSON 404 for retired API route %s", async (pathname) => {
    const paths: string[] = [];
    const response = await worker.fetch(
      new Request(`https://hexframe.test${pathname}`),
      environment(paths),
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({ error: "not_found" });
    expect(paths).toEqual([]);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("removes credential/session modules and application bindings", () => {
    for (const path of [
      "src/worker/auth/credentials.ts",
      "src/worker/auth/session.ts",
      "src/worker/routes/login.ts",
      "src/worker/routes/lab.ts",
      "src/worker/routes/codex.ts",
      "src/worker/routes/api-lab.ts",
      "scripts/dev-secrets.mjs",
      "scripts/dev-secret-cases.mjs",
    ]) {
      expect(existsSync(join(root, path)), path).toBe(false);
    }

    const env = readFileSync(join(root, "src/worker/env.ts"), "utf8");
    const workerSource = readFileSync(join(root, "src/worker/index.ts"), "utf8");
    expect(env).not.toContain("ADMIN_");
    expect(workerSource).not.toMatch(/auth\/|handleLogin|handleLogout|handleLab|handleCodex|session/i);
  });

  it("removes the standalone Codex and its move-demonstration-only code", () => {
    for (const path of [
      "codex/index.html",
      "src/client/codex-main.ts",
      "src/client/styles/codex.css",
      "src/lab/move-demonstration.ts",
      "src/lab/move-demonstration-scenario.ts",
      "src/lab/move-presentation.ts",
      "tests/lab/move-demonstration-scenario.test.ts",
      "tests/lab/move-presentation.test.ts",
      "tests/worker/codex.test.ts",
      "tests/worker/lab.test.ts",
    ]) {
      expect(existsSync(join(root, path)), path).toBe(false);
    }

    const vite = readFileSync(join(root, "vite.config.ts"), "utf8");
    const documents = readFileSync(join(root, "src/documents/site-documents.tsx"), "utf8");
    const trainingStyles = readFileSync(join(root, "src/client/styles/lab.css"), "utf8");
    expect(vite).not.toMatch(/codex/i);
    expect(documents).not.toMatch(/codex/i);
    expect(trainingStyles).not.toMatch(/codex-/i);
  });

  it("keeps local development credential-free without weakening lifecycle ownership", () => {
    const dev = readFileSync(join(root, "scripts/dev.mjs"), "utf8");
    const smoke = readFileSync(join(root, "scripts/dev-smoke.mjs"), "utf8");
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

    expect(dev).not.toMatch(/ADMIN_|loadRootEnv|requireEnv|dev-secrets|\.dev\.vars/);
    expect(smoke).toContain('assert.equal(existsSync(ROOT_ENV_PATH), false');
    expect(smoke).toContain('assert.equal(existsSync(LOCAL_DEV_VARS_PATH), false');
    expect(pkg.scripts["test:dev-secrets"]).toBeUndefined();
    expect(pkg.scripts.check).toContain("npm run test:dev-process-ownership");
    expect(pkg.scripts.check).toContain("npm run test:dev-lifecycle");
  });
});
