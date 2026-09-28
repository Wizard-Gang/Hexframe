import { describe, expect, it } from "vitest";

import { SNAPSHOT_VERSION, px } from "../../src/combat/constants";
import { Simulation } from "../../src/combat/simulation/simulation";
import { createTestFighter } from "../../src/content/test-fighter";
import { STAGE_CATALOG } from "../../src/game/session";
import { deserializeState, serializeState } from "../../src/rollback/snapshots/snapshot";

function fighter() {
  return createTestFighter();
}

describe("reduced Training engine", () => {
  it("accepts exactly two fighters", () => {
    const stage = STAGE_CATALOG["training-grid"].stage;
    const config = { characters: [fighter(), fighter()], startX: [px(-18), px(18)], seed: 0x5eed, stage };
    expect(new Simulation(config).getState().fighters).toHaveLength(2);
    expect(() => new Simulation({ ...config, characters: [fighter()], startX: [0] })).toThrow(/exactly 2 fighters/);
    expect(() => new Simulation({ ...config, characters: [fighter(), fighter(), fighter()], startX: [0, 1, 2] })).toThrow(/exactly 2 fighters/);
  });

  it("uses the Training Grid and snapshot version 11 contract", () => {
    const stage = STAGE_CATALOG["training-grid"].stage;
    expect(stage.id).toBe("training-grid");
    expect(SNAPSHOT_VERSION).toBe(11);
    const sim = new Simulation({ characters: [fighter(), fighter()], startX: [px(-18), px(18)], seed: 0x5eed, stage });
    const bytes = serializeState(sim.getState());
    const restored = deserializeState(bytes);
    expect(restored).toEqual(sim.getState());
    expect(serializeState(restored)).toEqual(bytes);
  });
});
