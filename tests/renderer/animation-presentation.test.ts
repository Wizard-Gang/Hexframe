import { describe, expect, it } from "vitest";

import { SCALE } from "../../src/combat/constants";
import { StateId } from "../../src/combat/types";
import { TEST_FIGHTER } from "../../src/content/test-fighter";
import type { RawAnimation } from "../../src/content/raw-types";
import { animationForState, animationFrameForState } from "../../src/renderer/animation/animator";
import { createSim } from "../helpers/harness";

const LOOP: RawAnimation = {
  name: "walk_forward",
  loop: true,
  duration: 24,
  keyframes: [{ frame: 0, bones: {} }, { frame: 24, bones: {} }],
};

describe("presentation state animation", () => {
  it("gives reactions and recovery dedicated clips", () => {
    const fighter = createSim().getState().fighters[0];


    fighter.state = StateId.HitstunStand;
    expect(animationForState(fighter, TEST_FIGHTER)).toBe("hit_stand");
    fighter.state = StateId.BlockstunCrouch;
    expect(animationForState(fighter, TEST_FIGHTER)).toBe("block_crouch");
    fighter.state = StateId.Landing;
    expect(animationForState(fighter, TEST_FIGHTER)).toBe("landing");
    fighter.state = StateId.Knockdown;
    fighter.stateFrame = 4;
    expect(animationForState(fighter, TEST_FIGHTER)).toBe("knockdown");
    fighter.stateFrame = 14;
    expect(animationForState(fighter, TEST_FIGHTER)).toBe("getup");
  });

  it("selects rise, apex and fall from authoritative vertical velocity", () => {
    const fighter = createSim().getState().fighters[0];
    fighter.state = StateId.Airborne;
    fighter.airborne = 1;
    fighter.vy = 3 * SCALE;
    expect(animationForState(fighter, TEST_FIGHTER)).toBe("jump_rise");
    fighter.vy = SCALE;
    expect(animationForState(fighter, TEST_FIGHTER)).toBe("jump_apex");
    fighter.vy = -3 * SCALE;
    expect(animationForState(fighter, TEST_FIGHTER)).toBe("jump_fall");
  });

  it("phases walk cycles from distance instead of elapsed state frames", () => {
    const fighter = createSim().getState().fighters[0];
    fighter.state = StateId.WalkForward;
    fighter.x = 12 * SCALE;
    fighter.stateFrame = 3;
    expect(animationFrameForState(fighter, TEST_FIGHTER, "walk_forward", LOOP, {
      phaseMode: "distance",
      strideDistance: 48,
    })).toBe(6);

    fighter.stateFrame = 300;
    expect(animationFrameForState(fighter, TEST_FIGHTER, "walk_forward", LOOP, {
      phaseMode: "distance",
      strideDistance: 48,
    })).toBe(6);
  });
});
