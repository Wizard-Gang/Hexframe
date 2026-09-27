import { describe, expect, it } from "vitest";

import { px } from "../../src/combat/constants";
import { resolveContacts } from "../../src/combat/hit-resolution/resolve";
import { Simulation } from "../../src/combat/simulation/simulation";
import type { FrameReport } from "../../src/combat/types";
import { ContactKind, InputBit, StateId } from "../../src/combat/types";
import { MoveId, TEST_FIGHTER } from "../../src/content/test-fighter";
import { Timeline } from "../../src/lab/timeline/timeline";

function report(): FrameReport {
  return { frame: 0, contacts: [], debuffs: [], moveStarts: [], stateChanges: [], entityEvents: [] };
}

function teamSim(friendlyFire = false): Simulation {
  return new Simulation({
    characters: [TEST_FIGHTER, TEST_FIGHTER, TEST_FIGHTER],
    startX: [px(-30), 0, px(20)],
    teams: [0, 0, 1],
    friendlyFire,
    seed: 7,
  });
}

describe("multi-fighter team combat", () => {
  it("allocates state and timeline input history for every configured fighter", () => {
    const sim = teamSim();
    const timeline = new Timeline(sim, 16);
    timeline.inputProvider = () => [0, 0, InputBit.Light];
    timeline.stepFrames(1);

    expect(sim.getState().fighters).toHaveLength(3);
    expect(sim.getState().inputHistory).toHaveLength(3);
    expect(timeline.recordedInputs()).toEqual([{ frame: 0, inputs: [0, 0, InputBit.Light] }]);
  });

  it("skips teammates and resolves the same hitbox against a hostile", () => {
    const sim = teamSim();
    const state = sim.getState();
    Object.assign(state.fighters[0], { state: StateId.Attack, moveId: MoveId.StandingLight, moveFrame: 4, facing: 1 });
    const events = report();

    resolveContacts(state, sim.characters(), [0, 0, 0], events, [0, 0, 1], false);

    expect(state.fighters[1].health).toBe(TEST_FIGHTER.health);
    expect(state.fighters[2].health).toBe(TEST_FIGHTER.health - 30);
    expect(events.contacts.map((contact) => contact.defender)).toEqual([2]);
  });

  it("can opt into friendly fire without changing authored damage", () => {
    const sim = teamSim(true);
    const state = sim.getState();
    Object.assign(state.fighters[0], { state: StateId.Attack, moveId: MoveId.StandingLight, moveFrame: 4, facing: 1 });
    const events = report();
    resolveContacts(state, sim.characters(), [0, 0, 0], events, [0, 0, 1], true);

    expect(state.fighters[1].health).toBe(TEST_FIGHTER.health - 30);
    expect(state.fighters[2].health).toBe(TEST_FIGHTER.health - 30);
    expect(events.contacts.map((contact) => contact.defender)).toEqual([1, 2]);
  });

  it("lets one attacker hitbox connect once with every overlapping hostile", () => {
    const sim = new Simulation({
      characters: [TEST_FIGHTER, TEST_FIGHTER, TEST_FIGHTER],
      startX: [px(-20), px(-20), px(20)],
      teams: [0, 0, 1],
      seed: 7,
    });
    const state = sim.getState();
    const hook = TEST_FIGHTER.moves.find((move) => move.id === MoveId.StandingLight)!;
    Object.assign(state.fighters[2], {
      state: StateId.Attack,
      moveId: hook.id,
      moveFrame: hook.hitboxes[0].startFrame,
      facing: -1,
    });

    const first = report();
    resolveContacts(state, sim.characters(), [0, 0, 0], first, [0, 0, 1], false);

    expect(first.contacts.map((contact) => contact.defender).sort()).toEqual([0, 1]);
    expect(state.fighters[0].health).toBeLessThan(TEST_FIGHTER.health);
    expect(state.fighters[1].health).toBeLessThan(TEST_FIGHTER.health);
    expect(state.fighters[2].hitFlagsByTarget[0]).not.toBe(0);
    expect(state.fighters[2].hitFlagsByTarget[1]).not.toBe(0);

    const health = [state.fighters[0].health, state.fighters[1].health];
    const second = report();
    resolveContacts(state, sim.characters(), [0, 0, 0], second, [0, 0, 1], false);

    expect(second.contacts).toHaveLength(0);
    expect([state.fighters[0].health, state.fighters[1].health]).toEqual(health);
  });

  it("preserves held-away blocking against a three-fighter team", () => {
    const sim = new Simulation({
      characters: [TEST_FIGHTER, TEST_FIGHTER, TEST_FIGHTER],
      startX: [px(-20), px(-160), px(20)],
      teams: [0, 0, 1],
      seed: 7,
    });
    const state = sim.getState();
    const hook = TEST_FIGHTER.moves.find((move) => move.id === MoveId.StandingLight)!;
    Object.assign(state.fighters[2], {
      state: StateId.Attack,
      moveId: hook.id,
      moveFrame: hook.hitboxes[0].startFrame,
      facing: -1,
    });
    const events = report();

    resolveContacts(state, sim.characters(), [InputBit.Left, 0, 0], events, [0, 0, 1], false);

    expect(events.contacts).toContainEqual(expect.objectContaining({ defender: 0, kind: ContactKind.Block }));
    expect(state.fighters[0].health).toBe(TEST_FIGHTER.health);
    expect(state.fighters[0].state).toBe(StateId.BlockstunStand);
  });
});
