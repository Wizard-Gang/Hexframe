import { describe, expect, it } from "vitest";
import { px } from "../../src/combat/constants";
import { canStartMove, moveOf, startMove } from "../../src/combat/commands/resolve";
import { GUARD_BREAK_STUN, resolveContacts } from "../../src/combat/hit-resolution/resolve";
import type { FrameReport } from "../../src/combat/types";
import { InputBit, StateId } from "../../src/combat/types";
import { writeInput } from "../../src/input/buffer/history";
import { MoveId, TEST_FIGHTER } from "../../src/content/test-fighter";
import { createSim, placeFighters } from "../helpers/harness";

function emptyReport(): FrameReport {
  return { frame: 0, contacts: [], moveStarts: [], stateChanges: [] };
}

function guardedContact(stamina: number, perfect: boolean) {
  const sim = createSim();
  placeFighters(sim, -18, 18);
  const state = sim.getState();
  const move = moveOf(TEST_FIGHTER, MoveId.StandingLight)!;
  startMove(state.fighters[0], TEST_FIGHTER, move);
  state.fighters[0].moveFrame = move.hitboxes[0].startFrame;
  state.fighters[1].stamina = stamina;
  state.frame = 5;
  if (perfect) writeInput(state, 1, state.frame, InputBit.Right);
  const report = emptyReport();
  resolveContacts(state, [TEST_FIGHTER, TEST_FIGHTER], [0, InputBit.Right], report);
  return { state, move, contact: report.contacts[0] };
}

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
    expect(fighter.stamina).toBe(TEST_FIGHTER.stamina - 14);

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

describe("guard stamina and perfect guard", () => {
  it("spends roughly one quarter raw damage and applies real local hitstop", () => {
    const { state, move, contact } = guardedContact(100, false);
    const expected = Math.ceil(move.hitboxes[0].damage / 4);
    expect(contact.guardStaminaDamage).toBe(expected);
    expect(state.fighters[1].stamina).toBe(100 - expected);
    expect(contact.hitstopAttacker).toBeGreaterThanOrEqual(4);
    expect(contact.perfectGuard).toBe(false);
  });

  it("recognizes a three-frame back press, reduces blockstun, and costs no stamina", () => {
    const { state, move, contact } = guardedContact(100, true);
    expect(contact.perfectGuard).toBe(true);
    expect(contact.guardStaminaDamage).toBe(0);
    expect(state.fighters[1].stamina).toBe(100);
    expect(state.fighters[1].stun).toBeLessThan(move.hitboxes[0].blockstun);
  });

  it("enters a deterministic guard break when stamina bottoms out", () => {
    const { state, contact } = guardedContact(1, false);
    expect(contact.guardBreak).toBe(true);
    expect(state.fighters[1].state).toBe(StateId.GuardBreak);
    expect(state.fighters[1].stun).toBe(GUARD_BREAK_STUN);
  });
});
