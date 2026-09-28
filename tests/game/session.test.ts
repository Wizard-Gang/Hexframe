import { describe, expect, it } from "vitest";

import { defaultSession, readGameSession, sessionUrl, STAGE_CATALOG } from "../../src/game/session";

describe("Training session routing", () => {
  it("defines one Training session and one Training Grid stage", () => {
    expect(defaultSession()).toEqual({
      mode: "training",
      options: { developerTools: false, tutorial: false },
    });
    expect(Object.keys(STAGE_CATALOG)).toEqual(["training-grid"]);
    expect(STAGE_CATALOG["training-grid"].name).toBe("Training Grid");
    expect(STAGE_CATALOG["training-grid"].stage.id).toBe("training-grid");
  });

  it("requires the explicit Training query and ignores retired session parameters", () => {
    expect(readGameSession(new URL("https://hexframe.test/play/"))).toBeNull();
    expect(readGameSession(new URL("https://hexframe.test/play/?mode=other"))).toBeNull();

    const restored = readGameSession(new URL("https://hexframe.test/play/?mode=training&stage=elsewhere&encounter=other"));
    expect(restored).toEqual(defaultSession());
  });

  it("round-trips developer tools and tutorial without any other session state", () => {
    const session = defaultSession();
    session.options.developerTools = true;
    session.options.tutorial = true;
    const url = new URL(sessionUrl(session), "https://hexframe.test");
    expect(url.pathname).toBe("/play/");
    expect([...url.searchParams.keys()].sort()).toEqual(["debug", "mode", "tutorial"]);
    expect(readGameSession(url)).toEqual(session);
  });
});
