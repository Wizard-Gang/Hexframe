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
import { forwardKinematics, inBone } from "../../src/rig/fk";
import { visualPaintOrder } from "../../src/rig/paint-order";
import { sampleClip } from "../../src/rig/sample";
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
      "crouch", "crouchGuard", "jump", "launched",
      "labGuard", "labIdle", "labOverhead", "labStagger", "labStrike", "labWalk", "labWave",
      "sweep", "uppercut",
    ]);
  });

  it("maps crouch, low block and the whole normal jump arc onto their authored clips", () => {
    const fighter = createSim().getState().fighters[0];

    fighter.state = StateId.Crouch;
    expect(fightLabPresentation(fighter, TEST_FIGHTER).clip).toBe("crouch");

    fighter.state = StateId.BlockstunCrouch;
    expect(fightLabPresentation(fighter, TEST_FIGHTER).clip).toBe("crouchGuard");

    fighter.state = StateId.JumpSquat;
    fighter.stateFrame = 2;
    expect(fightLabPresentation(fighter, TEST_FIGHTER)).toEqual({ clip: "jump", frame: 2 });

    fighter.state = StateId.Airborne;
    fighter.airborne = 1;
    fighter.stateFrame = 5;
    expect(fightLabPresentation(fighter, TEST_FIGHTER)).toEqual({
      clip: "jump",
      frame: TEST_FIGHTER.jumpSquatFrames + 5,
    });

    fighter.airborne = 0;
    fighter.state = StateId.Landing;
    fighter.stateFrame = 1;
    expect(fightLabPresentation(fighter, TEST_FIGHTER).clip).toBe("jump");
  });

  it("maps every kit move and airborne hitstun onto its intended authored clip", () => {
    const fighter = createSim().getState().fighters[0];

    fighter.state = StateId.Idle;
    expect(fightLabPresentation(fighter, TEST_FIGHTER).clip).toBe("labIdle");
    fighter.state = StateId.WalkForward;
    expect(fightLabPresentation(fighter, TEST_FIGHTER).clip).toBe("labWalk");
    fighter.state = StateId.BlockstunStand;
    expect(fightLabPresentation(fighter, TEST_FIGHTER).clip).toBe("labGuard");
    fighter.state = StateId.HitstunStand;
    expect(fightLabPresentation(fighter, TEST_FIGHTER).clip).toBe("labStagger");
    fighter.state = StateId.HitstunAir;
    expect(fightLabPresentation(fighter, TEST_FIGHTER).clip).toBe("launched");

    fighter.state = StateId.Attack;
    fighter.moveFrame = 7;
    fighter.moveId = MoveId.Jab;
    expect(fightLabPresentation(fighter, TEST_FIGHTER)).toEqual({ clip: "labStrike", frame: 7 });
    fighter.moveId = MoveId.Overhead;
    expect(fightLabPresentation(fighter, TEST_FIGHTER).clip).toBe("labOverhead");
    fighter.moveId = MoveId.Sweep;
    expect(fightLabPresentation(fighter, TEST_FIGHTER).clip).toBe("sweep");
    fighter.moveId = MoveId.Uppercut;
    expect(fightLabPresentation(fighter, TEST_FIGHTER).clip).toBe("uppercut");
  });

  it("reads crouch-guard low with both arms in front at either facing", () => {
    const profile = depthProfileForClip(FIGHTLAB_RIG, "crouchGuard");
    expect(profile).toBe("both-front");

    const pose = sampleClip(FIGHTLAB_CLIPS.crouchGuard, 0);
    const placed = forwardKinematics(FIGHTLAB_RIG, pose);
    const head = placed.get("head");
    const front = placed.get("forearm-front");
    const back = placed.get("forearm-back");
    expect(head).toBeDefined();
    expect(front).toBeDefined();
    expect(back).toBeDefined();

    const frontHand = inBone(front!, FIGHTLAB_RIG.byName.get("forearm-front")!.tip!);
    const backHand = inBone(back!, FIGHTLAB_RIG.byName.get("forearm-back")!.tip!);
    expect(frontHand.y).toBeGreaterThan(head!.y + 35);
    expect(backHand.y).toBeGreaterThan(head!.y + 35);

    for (const facing of [1, -1] as const) {
      const order = visualPaintOrder(FIGHTLAB_RIG, facing, profile);
      expect(order.indexOf("arm-front")).toBeGreaterThan(order.indexOf("torso"));
      expect(order.indexOf("arm-back")).toBeGreaterThan(order.indexOf("torso"));
    }
  });

  it("selects the intended depth profiles for locomotion and strikes", () => {
    expect(depthProfileForClip(FIGHTLAB_RIG, "crouch")).toBe("anatomical");
    expect(depthProfileForClip(FIGHTLAB_RIG, "jump")).toBe("locomotion");
    expect(depthProfileForClip(FIGHTLAB_RIG, "labIdle")).toBe("anatomical");
    expect(depthProfileForClip(FIGHTLAB_RIG, "labWalk")).toBe("locomotion");
    expect(depthProfileForClip(FIGHTLAB_RIG, "labGuard")).toBe("both-front");
    expect(depthProfileForClip(FIGHTLAB_RIG, "labStrike")).toBe("punch");
    expect(depthProfileForClip(FIGHTLAB_RIG, "sweep")).toBe("locomotion");
    expect(depthProfileForClip(FIGHTLAB_RIG, "uppercut")).toBe("punch");
    expect(depthProfileForClip(FIGHTLAB_RIG, "launched")).toBe("anatomical");

    for (const facing of [1, -1] as const) {
      const punch = visualPaintOrder(FIGHTLAB_RIG, facing, "punch");
      expect(punch).toHaveLength(11);
      expect(new Set(punch).size).toBe(11);
      expect(punch.indexOf("head")).toBeLessThan(punch.indexOf("arm-front"));
      expect(punch.indexOf("head")).toBeLessThan(punch.indexOf("arm-back"));
    }
  });
});
