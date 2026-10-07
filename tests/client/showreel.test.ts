import { describe, expect, it } from "vitest";
import { FIGHTLAB_CLIPS } from "../../src/renderer/character/fightlab-assets";
import { sampleShowreel } from "../../src/client/showreel";

const total = 120 + FIGHTLAB_CLIPS.labStrike.duration + FIGHTLAB_CLIPS.sweep.duration
  + FIGHTLAB_CLIPS.labOverhead.duration + FIGHTLAB_CLIPS.uppercut.duration + 5 * 12;

describe("rig showreel", () => {
  it("cycles through idle and all four attacks and returns to the same pose", () => {
    const seen = new Set(Array.from({ length: total }, (_, frame) => sampleShowreel(FIGHTLAB_CLIPS, frame).label));
    expect([...seen]).toEqual(["Idle", "Jab", "Sweep", "Overhead", "Uppercut"]);
    expect(sampleShowreel(FIGHTLAB_CLIPS, total)).toEqual(sampleShowreel(FIGHTLAB_CLIPS, 0));
  });

  it("keeps every clip boundary and the loop seam continuous", () => {
    let boundary = 0;
    for (const duration of [120, FIGHTLAB_CLIPS.labStrike.duration, FIGHTLAB_CLIPS.sweep.duration,
      FIGHTLAB_CLIPS.labOverhead.duration, FIGHTLAB_CLIPS.uppercut.duration]) {
      for (const at of [boundary + duration, boundary + duration + 12]) {
        const before = sampleShowreel(FIGHTLAB_CLIPS, at - 0.00001).pose;
        const after = sampleShowreel(FIGHTLAB_CLIPS, at).pose;
        for (const bone of new Set([...Object.keys(before), ...Object.keys(after)])) {
          for (const property of ["x", "y", "rotation"] as const) {
            expect(Math.abs((before[bone]?.[property] ?? 0) - (after[bone]?.[property] ?? 0))).toBeLessThan(0.01);
          }
        }
      }
      boundary += duration + 12;
    }
  });
});
