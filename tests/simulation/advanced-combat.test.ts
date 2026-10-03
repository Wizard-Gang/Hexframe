import { describe, expect, it } from "vitest";
import { px } from "../../src/combat/constants";
import { armorRemaining } from "../../src/combat/collision/boxes";
import { moveOf, startMove } from "../../src/combat/commands/resolve";
import { resolveContacts } from "../../src/combat/hit-resolution/resolve";
import { Simulation } from "../../src/combat/simulation/simulation";
import type { CharacterDef, FrameReport, MoveDef } from "../../src/combat/types";
import { StateId } from "../../src/combat/types";
import { MoveId, TEST_FIGHTER } from "../../src/content/test-fighter";
import { placeFighters } from "../helpers/harness";

function report(): FrameReport {
  return { frame: 0, contacts: [], moveStarts: [], stateChanges: [] };
}

function config(player: CharacterDef, dummy = TEST_FIGHTER): ConstructorParameters<typeof Simulation>[0] {
  return { characters: [player, dummy], startX: [px(-18), px(18)] };
}

describe("hyper armor engine contract", () => {
  it("still absorbs the authored number of strikes before hitstun", () => {
    const attack = moveOf(TEST_FIGHTER, MoveId.Jab)!;
    const base = moveOf(TEST_FIGHTER, MoveId.Uppercut)!;
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
