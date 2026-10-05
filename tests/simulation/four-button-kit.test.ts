import { describe, expect, it } from "vitest";
import { cancelAllowed } from "../../src/combat/commands/resolve";
import { px } from "../../src/combat/constants";
import { ContactKind, InputBit } from "../../src/combat/types";
import { MoveId, TEST_FIGHTER, TRAINING_START_X } from "../../src/content/test-fighter";
import { createSim } from "../helpers/harness";

describe("fixed-kit deterministic route", () => {
  it("lands Jab into Sweep into Uppercut from reset after one step forward", () => {
    const sim = createSim();
    expect(sim.getState().fighters.map((fighter) => fighter.x)).toEqual([...TRAINING_START_X]);

    const stepForwardFrames = 12;
    for (let frame = 0; frame < stepForwardFrames; frame++) sim.step([InputBit.Right, 0]);
    expect(sim.getState().fighters[0].x).toBe(px(-16));
    expect(sim.getState().fighters[1].x - sim.getState().fighters[0].x).toBe(px(56));

    const landed: number[] = [];
    let opening = true;
    let ashenQueued = false;
    let phoenixQueued = false;

    for (let frame = 0; frame < 240 && landed.length < 3; frame++) {
      const fighter = sim.getState().fighters[0];
      let input = 0;
      if (opening) {
        input = InputBit.Action1;
        opening = false;
      } else if (!ashenQueued && fighter.hitstop === 0 && cancelAllowed(fighter, TEST_FIGHTER, MoveId.Sweep)) {
        input = InputBit.Action2;
        ashenQueued = true;
      } else if (!phoenixQueued && fighter.hitstop === 0 && cancelAllowed(fighter, TEST_FIGHTER, MoveId.Uppercut)) {
        input = InputBit.Action4;
        phoenixQueued = true;
      }

      const report = sim.step([input, 0]);
      for (const contact of report.contacts) {
        if (contact.attacker === 0 && contact.kind === ContactKind.Hit) landed.push(contact.moveId);
      }
    }

    expect(landed.slice(0, 3)).toEqual([
      MoveId.Jab,
      MoveId.Sweep,
      MoveId.Uppercut,
    ]);
  });
});
