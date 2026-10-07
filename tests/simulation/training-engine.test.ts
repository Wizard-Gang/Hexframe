import { describe, expect, it } from "vitest";

import { px } from "../../src/combat/constants";
import { Simulation } from "../../src/combat/simulation/simulation";
import { InputBit } from "../../src/combat/types";
import { createTestFighter } from "../../src/content/test-fighter";
import { TRAINING_STAGE } from "../../src/renderer/svg/stage";

function fighter() {
  return createTestFighter();
}

describe("reduced Training engine", () => {
  it("accepts exactly two fighters", () => {
    const stage = TRAINING_STAGE;
    const config = { characters: [fighter(), fighter()], startX: [px(-18), px(18)], stage };
    expect(new Simulation(config).getState().fighters).toHaveLength(2);
    expect(() => new Simulation({ ...config, characters: [fighter()], startX: [0] })).toThrow(/exactly 2 fighters/);
    expect(() => new Simulation({ ...config, characters: [fighter(), fighter(), fighter()], startX: [0, 1, 2] })).toThrow(/exactly 2 fighters/);
  });

  it("uses the Training stage and gives the same state for the same inputs", () => {
    const stage = TRAINING_STAGE;
    expect(stage.id).toBe("training");
    const config = { characters: [fighter(), fighter()], startX: [px(-18), px(18)], stage };
    const first = new Simulation(config);
    const second = new Simulation(config);

    for (let frame = 0; frame < 48; frame++) {
      const inputs = [
        frame < 10 ? InputBit.Right : frame === 12 ? InputBit.Action1 : 0,
        frame < 6 ? InputBit.Left : 0,
      ];
      expect(second.step(inputs)).toEqual(first.step(inputs));
    }

    expect(second.getState()).toEqual(first.getState());
  });
});
