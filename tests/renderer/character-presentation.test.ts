import { describe, expect, it } from "vitest";

import idle from "../../characters/test_fighter/animations/idle.json";
import standingLight from "../../characters/test_fighter/animations/standing_light.json";
import walkBackward from "../../characters/test_fighter/animations/walk_backward.json";
import walkForward from "../../characters/test_fighter/animations/walk_forward.json";
import playerRig from "../../characters/test_fighter/rig.json";
import { ADDITIONAL_ANIMATIONS } from "../../src/content/additional-animations";
import {
  normalizeIdlePresentation,
  normalizeMovePresentation,
  normalizeWalkPresentation,
} from "../../src/content/player-presentation";
import { STATE_ANIMATIONS } from "../../src/content/state-animations";
import type { RawAnimation, RawBonePose } from "../../src/content/raw-types";
import { validateAnimation } from "../../src/content/validate";

function firstPose(animation: RawAnimation): Record<string, RawBonePose> {
  return animation.keyframes[0]?.bones ?? {};
}

function boneOrigin(name: string, pose: Record<string, RawBonePose>): { x: number; y: number } {
  const parts = new Map(playerRig.parts.map((part) => [part.name, part]));
  const chain: typeof playerRig.parts = [];
  let current = parts.get(name);
  while (current) {
    chain.unshift(current);
    current = current.parent === null ? undefined : parts.get(current.parent);
  }

  let x = 0;
  let y = 0;
  let degrees = 0;
  for (const part of chain) {
    const bone = pose[part.name];
    const localX = part.pivot.x + (bone?.x ?? 0);
    const localY = -(part.pivot.y + (bone?.y ?? 0));
    const radians = degrees * Math.PI / 180;
    x += localX * Math.cos(radians) - localY * Math.sin(radians);
    y += localX * Math.sin(radians) + localY * Math.cos(radians);
    degrees -= bone?.rotation ?? 0;
  }
  return { x, y };
}

function expectHandsForward(animation: RawAnimation): void {
  const poses = [firstPose(animation), animation.keyframes.at(-1)?.bones ?? {}];
  for (const pose of poses) {
    for (const side of ["l", "r"] as const) {
      const shoulder = boneOrigin(`arm_upper_${side}`, pose);
      const hand = boneOrigin(`hand_${side}`, pose);
      // Facing right: fighter-forward is +x. The renderer mirrors the entire node for
      // facing left, so the same local relationship becomes hand.x < shoulder.x there.
      expect(hand.x).toBeGreaterThan(shoulder.x);
      expect(-hand.x).toBeLessThan(-shoulder.x);
    }
  }
}

describe("character presentation authoring", () => {
  it("keeps neutral and move-boundary hands fighter-forward on both facings", () => {
    const parts = Object.fromEntries(playerRig.parts.map((part) => [part.name, part]));
    expect(parts.arm_upper_l.pivot.x).toBe(-2);
    expect(parts.arm_upper_r.pivot.x).toBe(2);

    expectHandsForward(normalizeIdlePresentation(validateAnimation(idle)));
    expectHandsForward(normalizeWalkPresentation(validateAnimation(walkForward)));
    expectHandsForward(normalizeWalkPresentation(validateAnimation(walkBackward), true));
    expectHandsForward(normalizeMovePresentation(validateAnimation(standingLight)));
    for (const animation of Object.values(ADDITIONAL_ANIMATIONS)) {
      expectHandsForward(normalizeMovePresentation(animation));
    }

    // Explicit block clips retain their stronger authored guard rather than being
    // flattened to the neutral presentation correction.
    for (const name of ["block_stand", "block_crouch"] as const) {
      const block = firstPose(STATE_ANIMATIONS[name]);
      expect(block.arm_upper_l?.rotation).toBeGreaterThan(0);
      expect(block.arm_lower_l?.rotation).toBeGreaterThan(0);
      expect(block.arm_upper_r?.rotation).toBeGreaterThan(0);
      expect(block.arm_lower_r?.rotation).toBeGreaterThan(0);
    }

    expect(walkForward.keyframes).toHaveLength(9);
    expect(walkBackward.keyframes).toHaveLength(9);
  });


});
