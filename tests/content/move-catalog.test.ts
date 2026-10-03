import { describe, expect, it } from "vitest";
import { cancelAllowed } from "../../src/combat/commands/resolve";
import { ACTION_SLOT_COUNT, actionBit } from "../../src/combat/types";
import { KIT_MOVE_IDS, MoveId, TEST_FIGHTER } from "../../src/content/test-fighter";
import { ADDITIONAL_ANIMATIONS } from "../../src/content/additional-animations";
import { createSim } from "../helpers/harness";

describe("fixed four-button move catalog", () => {
  it("contains two engine fixtures plus exactly four playable attacks", () => {
    expect(ACTION_SLOT_COUNT).toBe(4);
    expect(TEST_FIGHTER.moves.map((move) => move.key)).toEqual([
      "standing_light",
      "crouching_light",
      "jab",
      "overhead",
      "sweep",
      "uppercut",
    ]);
    expect(TEST_FIGHTER.commands.map((command) => command.moveId)).toEqual([...KIT_MOVE_IDS]);
    expect(TEST_FIGHTER.commands.map((command) => command.buttons)).toEqual([
      actionBit(0), actionBit(1), actionBit(2), actionBit(3),
    ]);
    expect(TEST_FIGHTER.commands.some((command) =>
      command.moveId === MoveId.StandingLight || command.moveId === MoveId.CrouchingLight,
    )).toBe(false);
  });

  it("retains only authored presentation clips for the playable kit", () => {
    expect(Object.keys(ADDITIONAL_ANIMATIONS)).toEqual([
      "jab",
      "overhead",
      "sweep",
      "uppercut",
    ]);
    for (const animation of Object.values(ADDITIONAL_ANIMATIONS)) {
      expect(animation.keyframes).toHaveLength(5);
    }
  });

  it("authors only the Jab to Sweep to Uppercut cancel chain", () => {
    const ember = TEST_FIGHTER.moves.find((move) => move.id === MoveId.Jab)!;
    const ashen = TEST_FIGHTER.moves.find((move) => move.id === MoveId.Sweep)!;
    const frost = TEST_FIGHTER.moves.find((move) => move.id === MoveId.Overhead)!;
    const phoenix = TEST_FIGHTER.moves.find((move) => move.id === MoveId.Uppercut)!;
    expect(ember.cancelWindows.flatMap((window) => window.into)).toEqual([MoveId.Sweep]);
    expect(ashen.cancelWindows.flatMap((window) => window.into)).toEqual([MoveId.Uppercut]);
    expect(frost.cancelWindows).toHaveLength(0);
    expect(phoenix.cancelWindows).toHaveLength(0);

    const fighter = createSim().getState().fighters[0];
    fighter.moveId = MoveId.Jab;
    fighter.moveFrame = ember.cancelWindows[0].startFrame;
    fighter.hitFlags = 1;
    expect(cancelAllowed(fighter, TEST_FIGHTER, MoveId.Sweep)).toBe(true);
    expect(cancelAllowed(fighter, TEST_FIGHTER, MoveId.Overhead)).toBe(false);
  });
});
