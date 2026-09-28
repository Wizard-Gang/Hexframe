import { describe, expect, it } from "vitest";
import type { FrameReport } from "../../src/combat/types";
import { DebuffKind, StateId } from "../../src/combat/types";
import {
  applyTaggedDebuffs,
  consumeDebuffBonuses,
  isFrozen,
  tickDebuffs,
} from "../../src/combat/status/debuffs";
import { applyGroundMotion } from "../../src/combat/movement/physics";
import { InputBit } from "../../src/combat/types";
import { TEST_FIGHTER } from "../../src/content/test-fighter";
import { createSim } from "../helpers/harness";

function report(): FrameReport {
  return { frame: 0, contacts: [], debuffs: [], moveStarts: [], stateChanges: [] };
}

describe("tag-driven debuffs", () => {
  it("turns burn and poison stacks into deterministic damage over time", () => {
    const sim = createSim();
    const target = sim.getState().fighters[1];
    const events = report();
    applyTaggedDebuffs(target, ["burn"], 0, 1, events);
    for (let stack = 0; stack < 3; stack++) applyTaggedDebuffs(target, ["poison"], 0, 1, events);

    const health = target.health;
    tickDebuffs(sim.getState(), events);
    expect(target.health).toBe(health - 5);
    expect(events.debuffs.some((event) => event.debuff === DebuffKind.Burn && event.damage === 2)).toBe(true);
    expect(events.debuffs.some((event) => event.debuff === DebuffKind.Poison && event.damage === 3)).toBe(true);
  });

  it("chills at one and two stacks, then freezes on the third", () => {
    const sim = createSim();
    const target = sim.getState().fighters[1];
    target.facing = 1;
    const events = report();
    applyTaggedDebuffs(target, ["freeze"], 0, 1, events);
    applyGroundMotion(target, TEST_FIGHTER, InputBit.Right);
    expect(target.vx).toBe(Math.trunc((TEST_FIGHTER.walkForwardSpeed * 3) / 4));

    target.state = StateId.Idle;
    applyTaggedDebuffs(target, ["freeze"], 0, 1, events);
    applyGroundMotion(target, TEST_FIGHTER, InputBit.Right);
    expect(target.vx).toBe(Math.trunc(TEST_FIGHTER.walkForwardSpeed / 2));

    applyTaggedDebuffs(target, ["freeze"], 0, 1, events);
    expect(isFrozen(target)).toBe(true);
    expect(target.freezeFrames).toBe(24);
  });

  it("consumes shock and bleed setups for explicit finisher bonuses", () => {
    const target = createSim().getState().fighters[1];
    const events = report();
    applyTaggedDebuffs(target, ["shock"], 0, 1, events);
    applyTaggedDebuffs(target, ["shock"], 0, 1, events);
    expect(consumeDebuffBonuses(target, ["heavy"], 100, 0, 1, events)).toBe(16);
    expect(target.shockStacks).toBe(0);

    applyTaggedDebuffs(target, ["bleed"], 0, 1, events);
    applyTaggedDebuffs(target, ["bleed"], 0, 1, events);
    expect(consumeDebuffBonuses(target, ["execute"], 70, 0, 1, events)).toBe(16);
    expect(target.bleedStacks).toBe(0);
  });


});
