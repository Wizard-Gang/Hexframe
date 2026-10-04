import { describe, expect, it } from "vitest";

import { StateId } from "../../src/combat/types";
import { MoveId, TEST_FIGHTER } from "../../src/content/test-fighter";
import {
  FIGHTER_HURTBOX_HEIGHT_PX,
  FIGHTLAB_CLIPS,
  FIGHTLAB_PARTS,
  FIGHTLAB_RIG,
  FIGHTLAB_STANDING_SCALE,
} from "../../src/renderer/character/fightlab-assets";
import {
  depthProfileForClip,
  fightLabPresentation,
} from "../../src/renderer/character/fightlab-presentation";
import { visualPaintOrder } from "../../src/rig/paint-order";
import { createSim } from "../helpers/harness";

describe("FightLab fighter presentation", () => {
  it("ships one machine-generated part for each of the 11 bones at the 104 px standing scale", () => {
    expect(FIGHTLAB_RIG.bones).toHaveLength(11);
    expect(Object.keys(FIGHTLAB_PARTS)).toHaveLength(11);
    expect(FIGHTLAB_RIG.contract.space.height).toBe(FIGHTER_HURTBOX_HEIGHT_PX);
    expect(FIGHTLAB_STANDING_SCALE).toBe(1);

    for (const bone of FIGHTLAB_RIG.bones) {
      expect(FIGHTLAB_PARTS[bone.name], bone.name).toContain(`data-bone="${bone.name}"`);
    }
    expect(Object.keys(FIGHTLAB_CLIPS).sort()).toEqual([
      "labGuard", "labIdle", "labOverhead", "labStagger", "labStrike", "labWalk", "labWave",
    ]);
  });

  it("maps current combat states and kit moves onto the seven authored lab clips", () => {
    const fighter = createSim().getState().fighters[0];

    fighter.state = StateId.Idle;
    expect(fightLabPresentation(fighter, TEST_FIGHTER).clip).toBe("labIdle");
    fighter.state = StateId.WalkForward;
    expect(fightLabPresentation(fighter, TEST_FIGHTER).clip).toBe("labWalk");
    fighter.state = StateId.BlockstunStand;
    expect(fightLabPresentation(fighter, TEST_FIGHTER).clip).toBe("labGuard");
    fighter.state = StateId.HitstunStand;
    expect(fightLabPresentation(fighter, TEST_FIGHTER).clip).toBe("labStagger");

    fighter.state = StateId.Attack;
    fighter.moveFrame = 7;
    fighter.moveId = MoveId.Jab;
    expect(fightLabPresentation(fighter, TEST_FIGHTER)).toEqual({ clip: "labStrike", frame: 7 });
    fighter.moveId = MoveId.Overhead;
    expect(fightLabPresentation(fighter, TEST_FIGHTER).clip).toBe("labOverhead");
  });

  it("borrows only existing clips for crouch, jump, Sweep and Uppercut until HF-183/HF-184", () => {
    const fighter = createSim().getState().fighters[0];

    fighter.state = StateId.Crouch;
    expect(fightLabPresentation(fighter, TEST_FIGHTER).clip).toBe("labGuard");
    fighter.state = StateId.Airborne;
    fighter.airborne = 1;
    expect(fightLabPresentation(fighter, TEST_FIGHTER).clip).toBe("labWalk");

    fighter.airborne = 0;
    fighter.state = StateId.Attack;
    fighter.moveId = MoveId.Sweep;
    expect(fightLabPresentation(fighter, TEST_FIGHTER).clip).toBe("labStrike");
    fighter.moveId = MoveId.Uppercut;
    expect(fightLabPresentation(fighter, TEST_FIGHTER).clip).toBe("labOverhead");
  });

  it("selects depth profiles that cross far and near arms correctly at both facings", () => {
    expect(depthProfileForClip(FIGHTLAB_RIG, "labIdle")).toBe("anatomical");
    expect(depthProfileForClip(FIGHTLAB_RIG, "labWalk")).toBe("locomotion");
    expect(depthProfileForClip(FIGHTLAB_RIG, "labGuard")).toBe("both-front");
    expect(depthProfileForClip(FIGHTLAB_RIG, "labStrike")).toBe("punch");

    const right = visualPaintOrder(FIGHTLAB_RIG, 1, "anatomical");
    expect(right.indexOf("arm-front")).toBeLessThan(right.indexOf("torso"));
    expect(right.indexOf("arm-back")).toBeGreaterThan(right.indexOf("torso"));

    const left = visualPaintOrder(FIGHTLAB_RIG, -1, "anatomical");
    expect(left.indexOf("arm-back")).toBeLessThan(left.indexOf("torso"));
    expect(left.indexOf("arm-front")).toBeGreaterThan(left.indexOf("torso"));

    for (const facing of [1, -1] as const) {
      const punch = visualPaintOrder(FIGHTLAB_RIG, facing, "punch");
      expect(punch).toHaveLength(11);
      expect(new Set(punch).size).toBe(11);
      expect(punch.indexOf("head")).toBeLessThan(punch.indexOf("arm-front"));
      expect(punch.indexOf("head")).toBeLessThan(punch.indexOf("arm-back"));
    }
  });
});
