import { describe, expect, it } from "vitest";
import { ContactKind, InputBit, StateId } from "../../src/combat/types";
import { MoveId, TEST_FIGHTER } from "../../src/content/test-fighter";
import { createSim, placeFighters, runFrames } from "../helpers/harness";

describe("contact resolution", () => {
  const basics = [MoveId.StandingLight, MoveId.CrouchingLight, ...Array.from({ length: 14 }, () => MoveId.StandingLight)];
  it("applies a standing light exactly once", () => {
    const sim = createSim(undefined, basics);
    placeFighters(sim, -18, 18);
    const reports = runFrames(sim, 12, (frame, player) =>
      player === 0 && frame === 0 ? InputBit.Light : 0,
    );
    const contacts = reports.flatMap((report) => report.contacts);
    expect(contacts).toHaveLength(1);
    expect(contacts[0].kind).toBe(ContactKind.Hit);
    expect(contacts[0].hurtboxId).toBeGreaterThanOrEqual(0);
    expect(contacts[0].overlapWidth).toBeGreaterThan(0);
    expect(contacts[0].overlapHeight).toBeGreaterThan(0);
    expect(contacts[0].hitstopDefender).toBeGreaterThan(0);
    expect(sim.getState().fighters[1].health).toBe(TEST_FIGHTER.health - 30);
    expect(sim.getState().fighters[1].state).toBe(StateId.HitstunStand);
  });

  it("blocks a mid while holding away", () => {
    const sim = createSim(undefined, basics);
    placeFighters(sim, -18, 18);
    const reports = runFrames(sim, 5, (frame, player) => {
      if (player === 0 && frame === 0) return InputBit.Light;
      return player === 1 ? InputBit.Right : 0;
    });
    expect(reports.flatMap((report) => report.contacts)[0].kind).toBe(ContactKind.Block);
    expect(sim.getState().fighters[1].health).toBe(TEST_FIGHTER.health);
    expect(sim.getState().fighters[1].state).toBe(StateId.BlockstunStand);
  });

  it("hits a standing guard with the crouching low", () => {
    const sim = createSim(undefined, basics);
    placeFighters(sim, -18, 18);
    const reports = runFrames(sim, 5, (frame, player) => {
      if (player === 0) return InputBit.Down | (frame === 0 ? InputBit.Action2 : 0);
      return InputBit.Right;
    });
    expect(reports.flatMap((report) => report.contacts)[0].kind).toBe(ContactKind.Hit);
    expect(sim.getState().fighters[1].health).toBe(TEST_FIGHTER.health - 20);
  });
});
