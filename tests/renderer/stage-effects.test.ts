import { describe, expect, it } from "vitest";

import {
  IMPACT_SHAKE_FRAMES,
  LANDING_DUST_FRAMES,
  StageMotionEffectQueue,
  impactShakeOffset,
} from "../../src/renderer/svg/stage-effects";

describe("stage motion effects", () => {
  it("records one dust puff per fighter landing frame and expires it", () => {
    const queue = new StageMotionEffectQueue();
    expect(queue.observeLanding(0, 1200, 0, 20, true)).toBe(true);
    expect(queue.observeLanding(0, 1200, 0, 20, true)).toBe(false);
    expect(queue.observeLanding(1, -1200, 0, 20, true)).toBe(true);
    expect(queue.activeDust(20)).toEqual([
      { player: 0, x: 1200, y: 0, spawnedFrame: 20 },
      { player: 1, x: -1200, y: 0, spawnedFrame: 20 },
    ]);
    expect(queue.activeDust(20 + LANDING_DUST_FRAMES - 1)).toHaveLength(2);
    expect(queue.activeDust(20 + LANDING_DUST_FRAMES)).toEqual([]);
  });

  it("marks reduced-motion landings as observed without drawing them later", () => {
    const queue = new StageMotionEffectQueue();
    expect(queue.observeLanding(0, 800, 0, 33, false)).toBe(false);
    expect(queue.activeDust(33)).toEqual([]);
    expect(queue.observeLanding(0, 800, 0, 33, true)).toBe(false);
  });

  it("shakes only for the four deterministic impact frames", () => {
    const queue = new StageMotionEffectQueue();
    queue.spawnImpact(50);
    for (let age = 0; age < IMPACT_SHAKE_FRAMES; age++) {
      expect(queue.shakeOffset(50 + age)).toEqual(impactShakeOffset(age));
      expect(queue.shakeOffset(50 + age)).not.toEqual({ x: 0, y: 0 });
    }
    expect(queue.shakeOffset(50 + IMPACT_SHAKE_FRAMES)).toEqual({ x: 0, y: 0 });
  });

  it("clears active dust and shake when reduced motion is enabled", () => {
    const queue = new StageMotionEffectQueue();
    queue.observeLanding(0, 400, 0, 70, true);
    queue.spawnImpact(70);
    queue.clearAnimated();
    expect(queue.activeDust(70)).toEqual([]);
    expect(queue.shakeOffset(70)).toEqual({ x: 0, y: 0 });
    expect(queue.observeLanding(0, 400, 0, 70, true)).toBe(false);
  });
});
