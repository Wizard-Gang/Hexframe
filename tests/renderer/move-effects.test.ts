import { describe, expect, it } from "vitest";

import { TEST_FIGHTER } from "../../src/content/test-fighter";
import { MOVE_VISUALS, moveEffectProfile, moveVisualDefinition } from "../../src/renderer/svg/move-effects";

describe("move particle profiles", () => {
  it("retains profiles only for the two fixtures and four playable techniques", () => {
    expect(Object.keys(MOVE_VISUALS)).toEqual([
      "standing_light",
      "crouching_light",
      "ember_palm",
      "frost_heel",
      "ashen_sweep",
      "phoenix_drive",
    ]);
    const signatures = Object.keys(MOVE_VISUALS).map((key) => {
      const move = TEST_FIGHTER.moves.find((candidate) => candidate.key === key)!;
      const profile = moveEffectProfile(move.id, move.tags, move.key);
      return [profile.kind, profile.effect, profile.trail, profile.impact].join(":");
    });
    expect(new Set(signatures).size).toBe(6);
  });

  it("keeps technique-specific visuals for the fixed kit", () => {
    expect(moveEffectProfile(3, ["fire", "burn"], "ember_palm").effect).toBe("palm_burst");
    expect(moveEffectProfile(11, ["fire", "burn"], "ashen_sweep").effect).toBe("ground_arc");
    expect(moveEffectProfile(5, ["cold", "freeze"], "frost_heel").effect).toBe("heel_comet");
    expect(moveEffectProfile(18, ["fire", "burn"], "phoenix_drive").effect).toBe("rising_spiral");
  });

  it("authors exact non-overlapping windows for every retained profile", () => {
    for (const key of Object.keys(MOVE_VISUALS)) {
      const visual = moveVisualDefinition(key);
      expect(visual.anchor).toBeTruthy();
      expect(visual.windows.telegraph[1]).toBeLessThan(visual.windows.trail[0]);
      expect(visual.windows.trail[1]).toBeLessThan(visual.windows.residue[0]);
    }
  });
});
