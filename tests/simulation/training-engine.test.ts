import { describe, expect, it } from "vitest";

import { SNAPSHOT_VERSION, px } from "../../src/combat/constants";
import { Simulation } from "../../src/combat/simulation/simulation";
import { DEFAULT_MOVE_LOADOUT, testFighterWithLoadout } from "../../src/content/test-fighter";
import { STAGE_CATALOG } from "../../src/game/session";
import { deserializeState, serializeState } from "../../src/rollback/snapshots/snapshot";

function fighter() {
  return testFighterWithLoadout(DEFAULT_MOVE_LOADOUT);
}

describe("HF-155 reduced Training engine", () => {
  it("accepts exactly two fighters", () => {
    const stage = STAGE_CATALOG["training-grid"].stage;
    const config = { characters: [fighter(), fighter()], startX: [px(-18), px(18)], seed: 0x5eed, stage };
    expect(new Simulation(config).getState().fighters).toHaveLength(2);
    expect(() => new Simulation({ ...config, characters: [fighter()], startX: [0] })).toThrow(/exactly 2 fighters/);
    expect(() => new Simulation({ ...config, characters: [fighter(), fighter(), fighter()], startX: [0, 1, 2] })).toThrow(/exactly 2 fighters/);
  });

  it("uses only the Training Grid and the reduced snapshot contract", () => {
    const stage = STAGE_CATALOG["training-grid"].stage;
    expect(stage.id).toBe("training-grid");
    expect(SNAPSHOT_VERSION).toBe(10);

    const sim = new Simulation({
      characters: [fighter(), fighter()],
      startX: [px(-18), px(18)],
      seed: 0x5eed,
      stage,
    });
    const bytes = serializeState(sim.getState());
    const restored = deserializeState(bytes);
    expect(restored).toEqual(sim.getState());
    expect(serializeState(restored)).toEqual(bytes);
  });
});
