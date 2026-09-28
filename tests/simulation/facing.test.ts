import { describe, expect, it } from "vitest";
import { createSim, placeFighters, runFrames } from "../helpers/harness";
import { InputBit, StateId } from "../../src/combat/types";

describe("facing", () => {
  it("starts with the fighters looking at each other", () => {
    const sim = createSim();
    expect(sim.getState().fighters[0].facing).toBe(1);
    expect(sim.getState().fighters[1].facing).toBe(-1);
  });

  it("turns a grounded, actionable fighter to face the opponent", () => {
    const sim = createSim();
    placeFighters(sim, 100, -100);
    runFrames(sim, 1);
    expect(sim.getState().fighters[0].facing).toBe(-1);
    expect(sim.getState().fighters[1].facing).toBe(1);
  });

  it("does not turn mid-move", () => {
    const sim = createSim();
    runFrames(sim, 1, (frame, player) => (player === 0 && frame === 0 ? InputBit.Action1 : 0));
    expect(sim.getState().fighters[0].state).toBe(StateId.Attack);

    placeFighters(sim, 100, -100);
    runFrames(sim, 1);
    // Still committed to the move, so still looking the way it was when it started.
    expect(sim.getState().fighters[0].facing).toBe(1);
  });

  it("does not turn while in hitstun", () => {
    const sim = createSim();
    placeFighters(sim, -30, 30);
    runFrames(sim, 10, (frame, player) => (player === 0 && frame === 0 ? InputBit.Action1 : 0));
    expect(sim.getState().fighters[1].state).toBe(StateId.HitstunStand);

    placeFighters(sim, 100, -100);
    runFrames(sim, 1);
    expect(sim.getState().fighters[1].facing).toBe(-1);
  });
});
