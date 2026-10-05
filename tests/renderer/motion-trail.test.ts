import { describe, expect, it } from "vitest";

import { MoveId, TEST_FIGHTER } from "../../src/content/test-fighter";
import {
  MOTION_TRAIL_FRAMES,
  placeTrailPoint,
  sampleMotionTrail,
  strikingBoneForMove,
} from "../../src/renderer/svg/motion-trail";
import type { TrailPoint } from "../../src/renderer/svg/motion-trail";

describe("rig motion trail sampling", () => {
  it("uses the same striking limbs that HF-185 fitted to the four authored moves", () => {
    expect(strikingBoneForMove("jab")).toBe("forearm-front");
    expect(strikingBoneForMove("sweep")).toBe("shin-front");
    expect(strikingBoneForMove("overhead")).toBe("forearm-front");
    expect(strikingBoneForMove("uppercut")).toBe("forearm-front");
    expect(strikingBoneForMove("idle")).toBeNull();
  });

  it("mirrors the same rig tip around the fighter origin at both facings", () => {
    const local = { x: 18, y: -42 };
    const origin = { x: 100, y: 240 };

    expect(placeTrailPoint(local, origin, 1, 1.5)).toEqual({ x: 127, y: 177 });
    expect(placeTrailPoint(local, origin, -1, 1.5)).toEqual({ x: 73, y: 177 });
  });

  it("keeps six frame samples and lets the last active tip disappear during recovery", () => {
    let trail: TrailPoint[] = [];
    for (let frame = 0; frame < MOTION_TRAIL_FRAMES + 2; frame++) {
      trail = sampleMotionTrail(trail, frame, { x: frame * 3, y: frame });
    }
    expect(trail.map((point) => point.frame)).toEqual([2, 3, 4, 5, 6, 7]);

    const uppercut = TEST_FIGHTER.moves.find((move) => move.id === MoveId.Uppercut)!;
    trail = [];
    const activeEnd = uppercut.startup + uppercut.active;
    for (let moveFrame = uppercut.startup; moveFrame < activeEnd; moveFrame++) {
      trail = sampleMotionTrail(trail, moveFrame, { x: moveFrame, y: -moveFrame });
    }
    expect(trail).toHaveLength(uppercut.active);

    for (let frame = activeEnd; frame < activeEnd + MOTION_TRAIL_FRAMES; frame++) {
      trail = sampleMotionTrail(trail, frame, null);
    }
    expect(trail).toEqual([]);
  });

  it("does not duplicate a sample when the same simulation frame renders twice", () => {
    let trail = sampleMotionTrail([], 12, { x: 10, y: 20 });
    trail = sampleMotionTrail(trail, 12, { x: 12, y: 22 });
    expect(trail).toEqual([{ frame: 12, x: 10, y: 20 }]);
  });
});
