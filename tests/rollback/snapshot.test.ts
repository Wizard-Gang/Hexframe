import { describe, expect, it } from "vitest";
import { InputBit } from "../../src/combat/types";
import { hashState } from "../../src/rollback/hashing/fnv";
import {
  cloneState,
  deserializeState,
  serializeState,
} from "../../src/rollback/snapshots/snapshot";
import { SnapshotRing } from "../../src/rollback/snapshots/ring";
import { createSim, runFrames } from "../helpers/harness";

describe("simulation snapshots", () => {
  it("round-trips every state field to identical bytes", () => {
    const sim = createSim();
    runFrames(sim, 20, (frame, player) =>
      player === 0 ? InputBit.Right | (frame === 8 ? InputBit.Light : 0) : InputBit.Left,
    );
    const bytes = serializeState(sim.getState());
    const restored = deserializeState(bytes);
    expect(restored).toEqual(sim.getState());
    expect(serializeState(restored)).toEqual(bytes);
    expect(hashState(restored)).toBe(hashState(sim.getState()));
  });

  it("returns deep copies from clone and the snapshot ring", () => {
    const sim = createSim();
    const copy = cloneState(sim.getState());
    copy.fighters[0].x = 99;
    copy.inputHistory[0][0] = InputBit.Heavy;
    expect(sim.getState().fighters[0].x).not.toBe(99);
    expect(sim.getState().inputHistory[0][0]).toBe(0);

    const ring = new SnapshotRing(2);
    ring.save(0, sim.getState());
    const first = ring.load(0)!;
    first.fighters[0].health = 1;
    expect(ring.load(0)!.fighters[0].health).not.toBe(1);
  });
});
