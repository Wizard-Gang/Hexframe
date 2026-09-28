import { describe, expect, it } from "vitest";
import { px } from "../../src/combat/constants";
import { armorRemaining } from "../../src/combat/collision/boxes";
import { canStartMove, moveOf, staminaCostOf, startMove } from "../../src/combat/commands/resolve";
import { resolveContacts } from "../../src/combat/hit-resolution/resolve";
import { JUMP_STAMINA_COST } from "../../src/combat/movement/physics";
import { Simulation } from "../../src/combat/simulation/simulation";
import type { CharacterDef, FrameReport, MoveDef } from "../../src/combat/types";
import { InputBit, StateId } from "../../src/combat/types";
import { MoveId, TEST_FIGHTER } from "../../src/content/test-fighter";
import { createSim, placeFighters, runFrames } from "../helpers/harness";

function report(): FrameReport {
  return { frame: 0, contacts: [], debuffs: [], moveStarts: [], stateChanges: [] };
}

function config(player: CharacterDef, dummy = TEST_FIGHTER): ConstructorParameters<typeof Simulation>[0] {
  return { characters: [player, dummy], startX: [px(-18), px(18)], seed: 0x5eed };
}

describe("stamina economy", () => {
  it("spends stamina on jumps and double-tap dashes, then regenerates on fixed frames", () => {
    const jump = createSim();
    jump.step([InputBit.Up, 0]);
    expect(jump.getState().fighters[0].stamina).toBe(TEST_FIGHTER.stamina - JUMP_STAMINA_COST);

    const dash = createSim();
    dash.step([InputBit.Right, 0]);
    dash.step([0, 0]);
    dash.step([InputBit.Right, 0]);
    const fighter = dash.getState().fighters[0];
    expect(fighter.state).toBe(StateId.Dash);
    expect(fighter.stamina).toBe(TEST_FIGHTER.stamina - TEST_FIGHTER.dashForward.staminaCost);
    runFrames(dash, 37);
    expect(fighter.stamina).toBe(TEST_FIGHTER.stamina - TEST_FIGHTER.dashForward.staminaCost + 1);
  });

  it("gates a retained technique by its authored stamina cost", () => {
    const move = moveOf(TEST_FIGHTER, MoveId.FrostHeel)!;
    expect(staminaCostOf(TEST_FIGHTER, move)).toBe(move.staminaCost);
    const fighter = new Simulation(config(TEST_FIGHTER)).getState().fighters[0];
    fighter.stamina = move.staminaCost - 1;
    expect(canStartMove(fighter, TEST_FIGHTER, move)).toBe(false);
    fighter.stamina = move.staminaCost;
    expect(canStartMove(fighter, TEST_FIGHTER, move)).toBe(true);
    startMove(fighter, TEST_FIGHTER, move);
    expect(fighter.stamina).toBe(0);
  });
});

describe("hyper armor engine contract", () => {
  it("still absorbs the authored number of strikes before hitstun", () => {
    const attack = moveOf(TEST_FIGHTER, MoveId.EmberPalm)!;
    const base = moveOf(TEST_FIGHTER, MoveId.PhoenixDrive)!;
    const armoredMove: MoveDef = {
      ...base,
      id: 99,
      key: "armor_fixture",
      armorWindows: [{ startFrame: 0, endFrame: base.duration - 1, hits: 1 }],
    };
    const defender: CharacterDef = { ...TEST_FIGHTER, moves: [...TEST_FIGHTER.moves, armoredMove] };
    const sim = new Simulation(config(TEST_FIGHTER, defender));
    placeFighters(sim, -18, 18);
    const state = sim.getState();
    const attacker = state.fighters[0];
    const target = state.fighters[1];
    startMove(attacker, TEST_FIGHTER, attack);
    startMove(target, defender, armoredMove);
    attacker.moveFrame = attack.hitboxes[0].startFrame;
    target.moveFrame = 0;

    const first = report();
    resolveContacts(state, [TEST_FIGHTER, defender], [0, 0], first);
    expect(first.contacts[0].armored).toBe(true);
    expect(target.state).toBe(StateId.Attack);
    expect(armorRemaining(target, defender)).toBe(0);

    startMove(attacker, TEST_FIGHTER, attack);
    attacker.moveFrame = attack.hitboxes[0].startFrame;
    const second = report();
    resolveContacts(state, [TEST_FIGHTER, defender], [0, 0], second);
    expect(second.contacts[0].armored).toBe(false);
    expect(target.state).toBe(StateId.HitstunStand);
  });
});
