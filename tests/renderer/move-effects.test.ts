import { describe, expect, it } from "vitest";

import { TEST_FIGHTER } from "../../src/content/test-fighter";
import { MOVE_VISUALS, moveEffectProfile, moveVisualDefinition } from "../../src/renderer/svg/move-effects";

describe("move particle profiles", () => {
  it("gives every move a distinct deterministic visual signature", () => {
    const signatures = TEST_FIGHTER.moves.map((move) => {
      const profile = moveEffectProfile(move.id, move.tags, move.key);
      return [profile.kind, profile.effect, profile.trail, profile.impact].join(":");
    });
    expect(signatures).toHaveLength(29);
    expect(new Set(signatures).size).toBe(29);
  });

  it("assigns technique-specific visual verbs within the same element family", () => {
    expect(moveEffectProfile(3, ["fire", "burn"], "ember_palm").effect).toBe("palm_burst");
    expect(moveEffectProfile(11, ["fire", "burn"], "ashen_sweep").effect).toBe("ground_arc");
    expect(moveEffectProfile(18, ["fire", "burn"], "phoenix_drive").effect).toBe("rising_spiral");
  });

  it("maps status families to readable effect themes", () => {
    expect(moveEffectProfile(3, ["fire", "burn"]).kind).toBe("fire");
    expect(moveEffectProfile(4, ["chaos", "poison"]).kind).toBe("poison");
    expect(moveEffectProfile(5, ["cold", "freeze"]).kind).toBe("freeze");
    expect(moveEffectProfile(6, ["lightning", "shock"]).kind).toBe("shock");
    expect(moveEffectProfile(24, ["elemental", "burn", "freeze", "shock"]).kind).toBe("prism");
  });

  it("never derives geometry from the numeric move id", () => {
    expect(moveEffectProfile(1, ["fire", "burn"], "ember_palm"))
      .toEqual(moveEffectProfile(9999, ["fire", "burn"], "ember_palm"));
  });

  it("authors an anchor and exact non-overlapping windows for every playable technique", () => {
    const moves = TEST_FIGHTER.moves;
    expect(Object.keys(MOVE_VISUALS)).toEqual(expect.arrayContaining(moves.map((move) => move.key)));
    for (const move of moves) {
      const visual = moveVisualDefinition(move.key);
      expect(visual.anchor).toBeTruthy();
      expect(visual.windows.telegraph[1]).toBeLessThan(visual.windows.trail[0]);
      expect(visual.windows.trail[1]).toBeLessThan(visual.windows.residue[0]);
    }
  });
});
