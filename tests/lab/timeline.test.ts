import { describe, expect, it } from "vitest";

import { px } from "../../src/combat/constants";
import { Simulation } from "../../src/combat/simulation/simulation";
import { InputBit } from "../../src/combat/types";
import { testFighterSimConfig } from "../../src/content/test-fighter";
import { Timeline } from "../../src/lab/timeline/timeline";

function contactTimeline(): { sim: Simulation; timeline: Timeline } {
  const config = { ...testFighterSimConfig(), startX: [px(-18), px(18)] as [number, number] };
  const sim = new Simulation(config);
  const timeline = new Timeline(sim);
  timeline.inputProvider = (frame) => [frame === 0 ? InputBit.Light : 0, 0];
  return { sim, timeline };
}

describe("combat lab timeline", () => {
  it("steps exactly one frame forward while paused", () => {
    const { sim, timeline } = contactTimeline();
    timeline.paused = true;

    const reports = timeline.stepFrames(1);

    expect(reports).toHaveLength(1);
    expect(reports[0].frame).toBe(0);
    expect(sim.getState().frame).toBe(1);
    expect(timeline.lastReport).toEqual(reports[0]);
    expect(timeline.tick(1)).toEqual([]);
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
