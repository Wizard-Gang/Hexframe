import { describe, expect, it } from "vitest";

import { createSessionCookie } from "../../src/worker/auth/session";
import type { Env } from "../../src/worker/env";
import { handleLab } from "../../src/worker/routes/lab";

function environment(): Env {
  return {
    ASSETS: { fetch: async () => new Response("unused") } as unknown as Fetcher,
    ENVIRONMENT: "test",
    ADMIN_USERNAME: "operator",
    ADMIN_PASSWORD: "test-password",
    ADMIN_SESSION_SECRET: "test-session-secret-that-is-long-enough",
  };
}

describe("developer laboratory route", () => {
  it("sends an unauthenticated visitor through sign in", async () => {
    const url = new URL("https://hexframe.test/lab/");
    const response = await handleLab(new Request(url), environment(), url);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/login?next=%2Flab%2F");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("");
  });

  it("preserves the requested lab path through the sign-in redirect", async () => {
    const url = new URL("https://hexframe.test/lab/moves/1?slot=2");
    const response = await handleLab(new Request(url), environment(), url);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/login?next=%2Flab%2Fmoves%2F1%3Fslot%3D2");
  });

  it("keeps authentication but redirects a verified operator to the unified public Training screen", async () => {
    const env = environment();
    const url = new URL("https://hexframe.test/lab/");
    const cookie = await createSessionCookie(env, "operator", 60, url);
    const response = await handleLab(new Request(url, { headers: { cookie } }), env, url);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/play/");
    expect(await response.text()).toBe("");
  });

  it("fails into the sign-in configuration check when credentials are not configured", async () => {
    const env = {
      ASSETS: { fetch: async () => new Response("unused") } as unknown as Fetcher,
      ENVIRONMENT: "test",
    };
    const url = new URL("https://hexframe.test/lab/");
    const response = await handleLab(new Request(url), env, url);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/login?next=%2Flab%2F");
  });
});
