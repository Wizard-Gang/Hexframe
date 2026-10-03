import { describe, expect, it } from "vitest";
import { ContactKind, InputBit, StateId } from "../../src/combat/types";
import { TEST_FIGHTER } from "../../src/content/test-fighter";
import { createSim, placeFighters, runFrames } from "../helpers/harness";

describe("contact resolution", () => {
  it("applies Jab exactly once", () => {
    const sim = createSim();
    placeFighters(sim, -18, 18);
    const reports = runFrames(sim, 12, (frame, player) =>
      player === 0 && frame === 0 ? InputBit.Action1 : 0,
    );
    const contacts = reports.flatMap((report) => report.contacts);
    expect(contacts).toHaveLength(1);
    expect(contacts[0].kind).toBe(ContactKind.Hit);
    expect(contacts[0].hurtboxId).toBeGreaterThanOrEqual(0);
    expect(contacts[0].overlapWidth).toBeGreaterThan(0);
    expect(contacts[0].overlapHeight).toBeGreaterThan(0);
    expect(contacts[0].hitstopDefender).toBeGreaterThan(0);
    expect(contacts[0].damage).toBe(38);
    expect(sim.getState().fighters[1].health).toBeLessThanOrEqual(TEST_FIGHTER.health - 38);
    expect(sim.getState().fighters[1].state).toBe(StateId.HitstunStand);
  });

  it("blocks a mid while holding away", () => {
    const sim = createSim();
    placeFighters(sim, -18, 18);
    const reports = runFrames(sim, 12, (frame, player) => {
      if (player === 0 && frame === 0) return InputBit.Action1;
      return player === 1 ? InputBit.Right : 0;
    });
    expect(reports.flatMap((report) => report.contacts)[0].kind).toBe(ContactKind.Block);
    expect(sim.getState().fighters[1].health).toBe(TEST_FIGHTER.health);
    expect(sim.getState().fighters[1].state).toBe(StateId.BlockstunStand);
  });

  it("hits a standing guard with Sweep low", () => {
    const sim = createSim();
    placeFighters(sim, -18, 18);
    const reports = runFrames(sim, 14, (frame, player) => {
      if (player === 0) return frame === 0 ? InputBit.Action2 : 0;
      return InputBit.Right;
    });
    expect(reports.flatMap((report) => report.contacts)[0].kind).toBe(ContactKind.Hit);
    const contact = reports.flatMap((report) => report.contacts)[0];
    expect(contact.damage).toBe(36);
    expect(sim.getState().fighters[1].health).toBeLessThanOrEqual(TEST_FIGHTER.health - 36);
  });

  it("blocks Sweep low while crouching away", () => {
    const sim = createSim();
    placeFighters(sim, -18, 18);
    const reports = runFrames(sim, 14, (frame, player) => {
      if (player === 0) return frame === 0 ? InputBit.Action2 : 0;
      return InputBit.Down | InputBit.Right;
    });
    expect(reports.flatMap((report) => report.contacts)[0].kind).toBe(ContactKind.Block);
    expect(sim.getState().fighters[1].health).toBe(TEST_FIGHTER.health);
    expect(sim.getState().fighters[1].state).toBe(StateId.BlockstunCrouch);
  });

  it("blocks Overhead while standing away", () => {
    const sim = createSim();
    placeFighters(sim, -18, 18);
    const reports = runFrames(sim, 16, (frame, player) => {
      if (player === 0) return frame === 0 ? InputBit.Action3 : 0;
      return InputBit.Right;
    });
    expect(reports.flatMap((report) => report.contacts)[0].kind).toBe(ContactKind.Block);
    expect(sim.getState().fighters[1].health).toBe(TEST_FIGHTER.health);
    expect(sim.getState().fighters[1].state).toBe(StateId.BlockstunStand);
  });
});
