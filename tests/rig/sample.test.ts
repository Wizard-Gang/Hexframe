import { describe, expect, it } from "vitest";

import { POSE_COUNT, POSE_INTERVALS } from "../../src/rig/clip-types";
import type { Clip, Pose } from "../../src/rig/clip-types";
import { sampleClip } from "../../src/rig/sample";
import { asClip, labClips } from "./fixtures";

const poses: Pose[] = Array.from({ length: POSE_COUNT }, (_unused, index) => ({
  torso: { rotation: index },
  "arm-front": { rotation: -20 + index * 10 },
}));

const PROBE: Clip = {
  loop: false,
  duration: 24,
  easing: "linear",
  poses,
};

describe("FightLab clip sampler", () => {
  it("keeps all seven authored lab clips in the 13-pose format", () => {
    expect(labClips).toHaveLength(7);
    for (const [name, raw] of labClips) {
      const clip = asClip(raw);
      expect(raw.key, name).toBe(name);
      expect(clip.poses, name).toHaveLength(POSE_COUNT);
    }
  });

  it("lands exactly on authored pose boundaries", () => {
    for (let index = 0; index <= POSE_INTERVALS; index += 1) {
      expect(sampleClip(PROBE, index * 2).torso.rotation, `pose ${index}`).toBeCloseTo(index, 10);
    }
  });

  it("interpolates phases without requiring duration to divide the pose count", () => {
    expect(sampleClip(PROBE, 1).torso.rotation).toBeCloseTo(0.5, 10);
    const odd: Clip = { ...PROBE, duration: 16 };
    expect(sampleClip(odd, 5).torso.rotation).toBeCloseTo(3.75, 10);
    expect(sampleClip(odd, 16).torso.rotation).toBeCloseTo(12, 10);
  });

  it("clamps one-shot clips and wraps looping clips", () => {
    expect(sampleClip(PROBE, -3).torso.rotation).toBeCloseTo(0, 10);
    expect(sampleClip(PROBE, 99).torso.rotation).toBeCloseTo(12, 10);
    const looping: Clip = { ...PROBE, loop: true, poses: [...poses.slice(0, POSE_INTERVALS), poses[0]] };
    expect(sampleClip(looping, 24).torso.rotation).toBeCloseTo(sampleClip(looping, 0).torso.rotation!, 10);
    expect(sampleClip(looping, 26).torso.rotation).toBeCloseTo(sampleClip(looping, 2).torso.rotation!, 10);
  });
});
