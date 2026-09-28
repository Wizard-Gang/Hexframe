import { describe, expect, it } from "vitest";

import { MoveId, TEST_FIGHTER } from "../../src/content/test-fighter";
import { codexMoveDetailMarkup, describeMoveFrame } from "../../src/lab/move-presentation";

describe("player-facing move presentation", () => {
  it("shows fixed input labels without selectable build state", () => {
    const ember = TEST_FIGHTER.moves.find((move) => move.id === MoveId.EmberPalm)!;
    const ashen = TEST_FIGHTER.moves.find((move) => move.id === MoveId.AshenSweep)!;
    expect(codexMoveDetailMarkup(ember, TEST_FIGHTER)).toContain("↑ / Y");
    expect(codexMoveDetailMarkup(ashen, TEST_FIGHTER)).toContain("← / X");
  });

  it("describes exact authoritative hitbox and cancel frames", () => {
    const ember = TEST_FIGHTER.moves.find((move) => move.id === MoveId.EmberPalm)!;
    expect(describeMoveFrame(ember, ember.hitboxes[0].startFrame, TEST_FIGHTER)).toContain("Hitbox: x");
    expect(describeMoveFrame(ember, ember.cancelWindows[0].startFrame, TEST_FIGHTER)).toContain("Cancel: ashen sweep");
  });
});
