import { describe, expect, it } from "vitest";
import { px } from "../../src/combat/constants";
import { canStartMove, moveOf } from "../../src/combat/commands/resolve";
import { InputBit, StateId } from "../../src/combat/types";
import { MoveId, TEST_FIGHTER } from "../../src/content/test-fighter";
import { createSim, placeFighters } from "../helpers/harness";

describe("authored dash feel", () => {
  it("uses the authored forward curve and permits an attack on frame four", () => {
    const sim = createSim();
    sim.step([InputBit.Right, 0]);
    sim.step([0, 0]);
    const beforeDash = sim.getState().fighters[0].x;
    sim.step([InputBit.Right, 0]);
    const fighter = sim.getState().fighters[0];
    expect(fighter.state).toBe(StateId.Dash);
    expect(fighter.x - beforeDash).toBe(TEST_FIGHTER.dashForward.velocities[0]);
    sim.step([0, 0]);
    sim.step([0, 0]);
    expect(fighter.stateFrame).toBe(3);
    expect(canStartMove(fighter, TEST_FIGHTER, moveOf(TEST_FIGHTER, MoveId.Jab)!)).toBe(true);
    sim.step([InputBit.Action1, 0]);
    expect(fighter.state).toBe(StateId.Attack);
    expect(fighter.moveId).toBe(MoveId.Jab);
  });

  it("covers the full 58px profile and transitions directly into held walk", () => {
    const sim = createSim();
    sim.step([InputBit.Right, 0]);
    sim.step([0, 0]);
    const start = sim.getState().fighters[0].x;
    sim.step([InputBit.Right, 0]);
    const fighter = sim.getState().fighters[0];
    while (fighter.state === StateId.Dash && fighter.stateFrame < TEST_FIGHTER.dashForward.velocities.length) {
      sim.step([InputBit.Right, 0]);
    }
    expect(fighter.x - start).toBe(px(58));
    sim.step([InputBit.Right, 0]);
    expect(fighter.state).toBe(StateId.WalkForward);
    expect(fighter.vx).toBe(TEST_FIGHTER.walkForwardSpeed);
  });
});
