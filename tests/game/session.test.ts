import { describe, expect, it } from "vitest";

import { STAGE_CATALOG } from "../../src/game/session";

describe("Training session authority", () => {
  it("defines exactly one Training Grid stage with no URL session model", () => {
    expect(Object.keys(STAGE_CATALOG)).toEqual(["training-grid"]);
    expect(STAGE_CATALOG["training-grid"].name).toBe("Training Grid");
    expect(STAGE_CATALOG["training-grid"].variant).toBe("training");
    expect(STAGE_CATALOG["training-grid"].stage.id).toBe("training-grid");
  });
});
