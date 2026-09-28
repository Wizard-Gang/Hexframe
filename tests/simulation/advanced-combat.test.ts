import { describe, expect, it } from "vitest";
import { px } from "../../src/combat/constants";
import { armorRemaining } from "../../src/combat/collision/boxes";
import { canStartMove, moveOf, staminaCostOf, startMove } from "../../src/combat/commands/resolve";
import { resolveContacts } from "../../src/combat/hit-resolution/resolve";
import { JUMP_STAMINA_COST } from "../../src/combat/movement/physics";
import { Simulation } from "../../src/combat/simulation/simulation";
import type { CharacterDef, FrameReport } from "../../src/combat/types";
import { InputBit, StateId } from "../../src/combat/types";
import {
  DEFAULT_MOVE_LOADOUT,
  MoveId,
  TEST_FIGHTER,
  testFighterWithLoadout,
} from "../../src/content/test-fighter";
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

  it("gates techniques by their authored stamina cost", () => {
    const base = testFighterWithLoadout(DEFAULT_MOVE_LOADOUT);
    const poisonMove = moveOf(base, MoveId.VenomFang)!;
    expect(staminaCostOf(base, poisonMove)).toBe(poisonMove.staminaCost);

    const fighter = new Simulation(config(base)).getState().fighters[0];
    fighter.stamina = poisonMove.staminaCost - 1;
    expect(canStartMove(fighter, base, poisonMove)).toBe(false);
    fighter.stamina = poisonMove.staminaCost;
    expect(canStartMove(fighter, base, poisonMove)).toBe(true);
    startMove(fighter, base, poisonMove);
    expect(fighter.stamina).toBe(0);
  });
});

describe("aerial combat", () => {
  it("requires air state for air techniques and preserves air state when they recover", () => {
    const airLoadout = [MoveId.AstralJab, ...DEFAULT_MOVE_LOADOUT.slice(1)];
    const character = testFighterWithLoadout(airLoadout);
    const sim = new Simulation(config(character));
    const fighter = sim.getState().fighters[0];

    sim.step([InputBit.Action1, 0]);
    expect(fighter.moveId).not.toBe(MoveId.AstralJab);

    fighter.y = px(140);
    fighter.airborne = 1;
    fighter.state = StateId.Airborne;
    sim.step([0, 0]);
    sim.step([InputBit.Action1, 0]);
    expect(fighter.moveId).toBe(MoveId.AstralJab);
    expect(fighter.stamina).toBe(character.stamina - moveOf(character, MoveId.AstralJab)!.staminaCost);

    runFrames(sim, moveOf(character, MoveId.AstralJab)!.duration);
    expect(fighter.airborne).toBe(1);
    expect(fighter.state).toBe(StateId.Airborne);
  });

  it("Rift Uppercut launches both fighters and exposes authored air cancels", () => {
    const loadout = [MoveId.RiftUppercut, MoveId.AstralJab, MoveId.WitchKnee, MoveId.VoidDive, ...DEFAULT_MOVE_LOADOUT.slice(4)];
    const character = testFighterWithLoadout(loadout);
    const sim = new Simulation(config(character));
    placeFighters(sim, -18, 18);
    const reports = runFrames(sim, 30, (frame, player) => player === 0 && frame === 0 ? InputBit.Action1 : 0);
    const contact = reports.flatMap((item) => item.contacts)[0];
    const rift = moveOf(character, MoveId.RiftUppercut)!;

    expect(contact?.moveId).toBe(MoveId.RiftUppercut);
    expect(sim.getState().fighters[1].airborne).toBe(1);
    expect(rift.cancelWindows[0].into).toEqual([25, 26, 27, 28]);
  });
});

describe("true hyper armor", () => {
  it("absorbs one strike without cancelling Bastion Break, then breaks on the next", () => {
    const attacker = testFighterWithLoadout(DEFAULT_MOVE_LOADOUT);
    const defender = testFighterWithLoadout([MoveId.BastionBreak, ...DEFAULT_MOVE_LOADOUT.slice(1)]);
    const sim = new Simulation(config(attacker, defender));
    placeFighters(sim, -18, 18);
    const state = sim.getState();
    const attack = moveOf(attacker, MoveId.StandingLight)!;
    const bastion = moveOf(defender, MoveId.BastionBreak)!;
    const a = state.fighters[0];
    const d = state.fighters[1];
    startMove(a, attacker, attack);
    startMove(d, defender, bastion);
    a.moveFrame = attack.hitboxes[0].startFrame;
    d.moveFrame = bastion.startup - 1;

    const first = report();
    resolveContacts(state, [attacker, defender], [0, 0], first);
    expect(first.contacts[0].armored).toBe(true);
    expect(d.health).toBeLessThan(defender.health);
    expect(d.moveId).toBe(MoveId.BastionBreak);
    expect(d.state).toBe(StateId.Attack);
    expect(armorRemaining(d, defender)).toBe(0);

    startMove(a, attacker, attack);
    a.moveFrame = attack.hitboxes[0].startFrame;
    const second = report();
    resolveContacts(state, [attacker, defender], [0, 0], second);
    expect(second.contacts[0].armored).toBe(false);
    expect(d.moveId).toBe(-1);
    expect(d.state).toBe(StateId.HitstunStand);
  });
});
