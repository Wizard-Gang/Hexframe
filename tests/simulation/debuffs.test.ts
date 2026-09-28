import { describe, expect, it } from "vitest";
import type { FrameReport } from "../../src/combat/types";
import { DebuffKind, InputBit, StateId } from "../../src/combat/types";
import { applyTaggedDebuffs, consumeDebuffBonuses, isFrozen, tickDebuffs } from "../../src/combat/status/debuffs";
import { applyGroundMotion } from "../../src/combat/movement/physics";
import { TEST_FIGHTER } from "../../src/content/test-fighter";
import { createSim } from "../helpers/harness";

function report(): FrameReport {
  return { frame: 0, contacts: [], debuffs: [], moveStarts: [], stateChanges: [] };
}

describe("retained Training statuses", () => {
  it("keeps deterministic burn damage over time", () => {
    const sim = createSim();
    const target = sim.getState().fighters[1];
    const events = report();
    applyTaggedDebuffs(target, ["burn"], 0, 1, events);
    const health = target.health;
    tickDebuffs(sim.getState(), events);
    expect(target.health).toBe(health - 2);
    expect(events.debuffs.some((event) => event.debuff === DebuffKind.Burn && event.damage === 2)).toBe(true);
  });

  it("chills at one and two stacks, then freezes on the third", () => {
    const target = createSim().getState().fighters[1];
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

  it("stores only the two retained status stack/timer pairs", () => {
    const target = createSim().getState().fighters[1] as unknown as Record<string, unknown>;
    const statusFields = Object.keys(target)
      .filter((key) => key.endsWith("Stacks") || key.endsWith("Frames"))
      .sort();
    expect(statusFields).toEqual(["burnFrames", "burnStacks", "freezeFrames", "freezeStacks"]);
  });

  it("retains direct-hit bonuses for burn and freeze", () => {
    const target = createSim().getState().fighters[1];
    const events = report();
    applyTaggedDebuffs(target, ["burn"], 0, 1, events);
    applyTaggedDebuffs(target, ["freeze"], 0, 1, events);
    expect(consumeDebuffBonuses(target, ["burn", "freeze"], 100, 0, 1, events)).toBe(7);
  });
});
