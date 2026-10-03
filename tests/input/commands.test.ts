import { describe, expect, it } from "vitest";
import { InputBit } from "../../src/combat/types";
import { MoveId } from "../../src/content/test-fighter";
import { createSim, runFrames } from "../helpers/harness";

describe("command parsing", () => {
  it("starts each fixed kit move from one independent action bit", () => {
    const cases = [
      [InputBit.Action1, MoveId.Jab],
      [InputBit.Action2, MoveId.Sweep],
      [InputBit.Action3, MoveId.Overhead],
      [InputBit.Action4, MoveId.Uppercut],
    ] as const;
    for (const [input, moveId] of cases) {
      const reports = runFrames(createSim(), 1, (_frame, player) => player === 0 ? input : 0);
      expect(reports[0].moveStarts).toEqual([{ player: 0, moveId }]);
    }
  });

  it("starts every attack directly while an ordinary direction is held", () => {
    const cases = [
      [InputBit.Action1, MoveId.Jab],
      [InputBit.Action2, MoveId.Sweep],
      [InputBit.Action3, MoveId.Overhead],
      [InputBit.Action4, MoveId.Uppercut],
    ] as const;
    for (const [button, moveId] of cases) {
      const reports = runFrames(createSim(), 1, (_frame, player) =>
        player === 0 ? InputBit.Right | button : 0,
      );
      expect(reports[0].moveStarts).toEqual([{ player: 0, moveId }]);
    }
  });

  it("does not turn one held button into repeated moves", () => {
    const reports = runFrames(createSim(), 40, (_frame, player) =>
      player === 0 ? InputBit.Action1 : 0,
    );
    expect(reports.flatMap((report) => report.moveStarts)).toHaveLength(1);
  });
});
