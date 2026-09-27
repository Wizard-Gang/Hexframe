import { describe, expect, it } from "vitest";
import { px } from "../../src/combat/constants";
import { canStartMove, moveOf, startMove } from "../../src/combat/commands/resolve";
import { GUARD_BREAK_STUN, resolveContacts } from "../../src/combat/hit-resolution/resolve";
import { Simulation } from "../../src/combat/simulation/simulation";
import type { FrameReport } from "../../src/combat/types";
import { EntityEventKind, InputBit, InteractableKind, StateId } from "../../src/combat/types";
import { writeInput } from "../../src/input/buffer/history";
import { serializeState, deserializeState } from "../../src/rollback/snapshots/snapshot";
import { BLACK_BELFRY } from "../../src/content/black-belfry";
import { DEFAULT_MOVE_LOADOUT, MoveId, TEST_FIGHTER, testFighterWithLoadout } from "../../src/content/test-fighter";
import { createSim, placeFighters } from "../helpers/harness";

function emptyReport(): FrameReport {
  return { frame: 0, contacts: [], debuffs: [], moveStarts: [], stateChanges: [], entityEvents: [] };
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
    expect(canStartMove(fighter, TEST_FIGHTER, moveOf(TEST_FIGHTER, MoveId.EmberPalm)!)).toBe(true);
    sim.step([InputBit.Action1, 0]);
    expect(fighter.state).toBe(StateId.Attack);
    expect(fighter.moveId).toBe(MoveId.EmberPalm);
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

describe("Black Belfry deterministic entities", () => {
  function stageSim(): Simulation {
    const player = testFighterWithLoadout(DEFAULT_MOVE_LOADOUT);
    return new Simulation({
      characters: [player, TEST_FIGHTER],
      startX: [BLACK_BELFRY.spawnX, px(1130)],
      seed: 0x5eed,
      stage: BLACK_BELFRY,
    });
  }

  it("records E/RB interaction and locks the boss arena from the stage definition", () => {
    const sim = stageSim();
    const state = sim.getState();
    state.fighters[0].x = BLACK_BELFRY.bossArena.gateX - px(30);
    const report = sim.step([InputBit.Interact, 0]);
    expect(state.stage.arenaLocked).toBe(1);
    expect(state.stage.bossActive).toBe(1);
    expect(report.entityEvents).toContainEqual(expect.objectContaining({
      kind: EntityEventKind.Interacted,
      owner: InteractableKind.BossGate,
    }));
    const restored = deserializeState(serializeState(state));
    expect(restored).toEqual(state);
    expect(restored.inputHistory[0][0] & InputBit.Interact).toBe(InputBit.Interact);
  });

  it("breaks stage junk into a seeded pickup and spawns the boss reward only on boss defeat", () => {
    const sim = stageSim();
    const state = sim.getState();
    const breakable = state.entities.find((entity) => entity.id === 101)!;
    state.fighters[0].x = breakable.x - px(20);
    const move = moveOf(sim.characters()[0], MoveId.EmberPalm)!;
    startMove(state.fighters[0], sim.characters()[0], move);
    state.fighters[0].moveFrame = move.hitboxes[0].startFrame - 1;
    const report = sim.step([0, 0]);
    expect(report.entityEvents.some((event) => event.kind === EntityEventKind.Broken && event.entityId === 101)).toBe(true);
    expect(report.entityEvents.some((event) => event.kind === EntityEventKind.Spawned)).toBe(true);

    state.fighters[1].health = 0;
    state.roundOver = 1;
    const defeat = sim.step([0, 0]);
    expect(defeat.entityEvents).toContainEqual(expect.objectContaining({ entityId: 900, kind: EntityEventKind.Spawned }));
    expect(state.stage.rewardSpawned).toBe(1);
  });
});
