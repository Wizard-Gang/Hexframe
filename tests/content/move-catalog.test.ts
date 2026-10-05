import { describe, expect, it } from "vitest";
import { cancelAllowed } from "../../src/combat/commands/resolve";
import { ACTION_SLOT_COUNT, actionBit } from "../../src/combat/types";
import { KIT_MOVE_IDS, MoveId, TEST_FIGHTER } from "../../src/content/test-fighter";
import { createSim } from "../helpers/harness";

describe("typed four-button move catalog", () => {
  it("contains exactly the four playable kit attacks", () => {
    expect(ACTION_SLOT_COUNT).toBe(4);
    expect(TEST_FIGHTER.moves.map((move) => move.key)).toEqual([
      "jab",
      "sweep",
      "overhead",
      "uppercut",
    ]);
    expect(TEST_FIGHTER.commands.map((command) => command.moveId)).toEqual([...KIT_MOVE_IDS]);
    expect(TEST_FIGHTER.commands.map((command) => command.buttons)).toEqual([
      actionBit(0), actionBit(1), actionBit(2), actionBit(3),
    ]);
  });

  it("converts authored pixel values into exact integer simulation units", () => {
    expect(TEST_FIGHTER.walkBackwardSpeed).toBe(150);
    expect(TEST_FIGHTER.gravity).toBe(60);
    expect(TEST_FIGHTER.moves.find((move) => move.id === MoveId.Jab)?.hitboxes[0].box.x).toBe(3400);
  });

  it("publishes the clip-fitted frame data used by the move list", () => {
    expect(KIT_MOVE_IDS.map((moveId) => {
      const move = TEST_FIGHTER.moves.find((candidate) => candidate.id === moveId)!;
      return [move.key, move.startup, move.active, move.recovery, move.duration];
    })).toEqual([
      ["jab", 5, 3, 12, 20],
      ["sweep", 8, 4, 14, 26],
      ["overhead", 16, 2, 12, 30],
      ["uppercut", 9, 5, 22, 36],
    ]);
  });

  it("authors only the Jab to Sweep to Uppercut cancel chain", () => {
    const jab = TEST_FIGHTER.moves.find((move) => move.id === MoveId.Jab)!;
    const sweep = TEST_FIGHTER.moves.find((move) => move.id === MoveId.Sweep)!;
    const overhead = TEST_FIGHTER.moves.find((move) => move.id === MoveId.Overhead)!;
    const uppercut = TEST_FIGHTER.moves.find((move) => move.id === MoveId.Uppercut)!;
    expect(jab.cancelWindows.flatMap((window) => window.into)).toEqual([MoveId.Sweep]);
    expect(sweep.cancelWindows.flatMap((window) => window.into)).toEqual([MoveId.Uppercut]);
    expect(overhead.cancelWindows).toHaveLength(0);
    expect(uppercut.cancelWindows).toHaveLength(0);

    const fighter = createSim().getState().fighters[0];
    fighter.moveId = MoveId.Jab;
    fighter.moveFrame = jab.cancelWindows[0].startFrame;
    fighter.hitFlags = 1;
    expect(cancelAllowed(fighter, TEST_FIGHTER, MoveId.Sweep)).toBe(true);
    expect(cancelAllowed(fighter, TEST_FIGHTER, MoveId.Overhead)).toBe(false);
  });
});
