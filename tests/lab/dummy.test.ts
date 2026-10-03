import { describe, expect, it } from "vitest";
import type { FrameReport } from "../../src/combat/types";
import { ContactKind, InputBit, StateId } from "../../src/combat/types";
import { DummyController, DummyMode } from "../../src/lab/dummy/dummy";
import { createSim } from "../helpers/harness";

describe("Training dummy modes", () => {
  it("exposes exactly Stand, Block and Fight back", () => {
    expect(DummyMode).toEqual({ Stand: 0, Block: 1, FightBack: 2 });
  });

  it("stands without acting", () => {
    const dummy = new DummyController();
    expect(dummy.inputFor(createSim().getState(), 1, null)).toBe(0);
  });

  it("blocks by holding away", () => {
    const dummy = new DummyController();
    dummy.mode = DummyMode.Block;
    expect(dummy.inputFor(createSim().getState(), 1, null)).toBe(InputBit.Right);
  });

  it("blocks, then jabs once after a blocked contact when actionable", () => {
    const dummy = new DummyController();
    dummy.mode = DummyMode.FightBack;
    const state = createSim().getState();

    expect(dummy.inputFor(state, 1, null)).toBe(InputBit.Right);

    state.fighters[1].state = StateId.BlockstunStand;
    state.fighters[1].stun = 1;
    const blocked = {
      frame: state.frame,
      contacts: [{ defender: 1, kind: ContactKind.Block }],
      moveStarts: [],
      stateChanges: [],
    } as unknown as FrameReport;
    expect(dummy.inputFor(state, 1, blocked)).toBe(InputBit.Right);

    state.fighters[1].state = StateId.Idle;
    state.fighters[1].stun = 0;
    expect(dummy.inputFor(state, 1, null)).toBe(InputBit.Action1);
    expect(dummy.inputFor(state, 1, null)).toBe(InputBit.Right);
  });
});
