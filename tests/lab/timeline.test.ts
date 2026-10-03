import { describe, expect, it } from "vitest";

import { px } from "../../src/combat/constants";
import { Simulation } from "../../src/combat/simulation/simulation";
import { InputBit } from "../../src/combat/types";
import { testFighterSimConfig } from "../../src/content/test-fighter";
import { hashState } from "../../src/rollback/hashing/fnv";
import { Timeline } from "../../src/lab/timeline/timeline";

function contactTimeline(): { sim: Simulation; timeline: Timeline } {
  const config = { ...testFighterSimConfig(), startX: [px(-18), px(18)] as [number, number] };
  const sim = new Simulation(config);
  const timeline = new Timeline(sim, 120);
  timeline.inputProvider = (frame) => [frame === 0 ? InputBit.Light : 0, 0];
  return { sim, timeline };
}

describe("combat lab timeline", () => {
  it("reuses recorded inputs when moving forward after an exact rewind", () => {
    const { sim, timeline } = contactTimeline();
    timeline.pauseOnContact = false;
    timeline.stepFrames(14);
    const expectedHash = hashState(sim.getState());

    timeline.stepFrames(-10);
    expect(sim.getState().frame).toBe(4);
    timeline.stepFrames(10);

    expect(sim.getState().frame).toBe(14);
    expect(hashState(sim.getState())).toBe(expectedHash);
    expect(timeline.contactReports()).toHaveLength(1);
  });

  it("stops a multi-frame advance on the resolved contact frame", () => {
    const { sim, timeline } = contactTimeline();
    timeline.pauseOnContact = true;
    const reports = timeline.stepFrames(20);
    const contact = reports.find((report) => report.contacts.length > 0);

    expect(contact).toBeDefined();
    expect(timeline.paused).toBe(true);
    expect(sim.getState().frame).toBe(contact!.frame + 1);
    expect(timeline.lastMessage).toContain(`Contact on frame ${contact!.frame}`);
  });

});
