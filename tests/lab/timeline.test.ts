import { describe, expect, it } from "vitest";

import { Simulation } from "../../src/combat/simulation/simulation";
import { testFighterSimConfig } from "../../src/content/test-fighter";
import { Timeline } from "../../src/lab/timeline/timeline";

function createTimeline(): { sim: Simulation; timeline: Timeline } {
  const sim = new Simulation(testFighterSimConfig());
  return { sim, timeline: new Timeline(sim) };
}

describe("combat lab timeline", () => {
  it("runs ordinary Training at one simulation frame per real frame", () => {
    const { sim, timeline } = createTimeline();

    expect(timeline.tick(3)).toHaveLength(3);
    expect(sim.getState().frame).toBe(3);
  });

  it("runs Slow-mo at exactly 25 percent", () => {
    const { sim, timeline } = createTimeline();
    timeline.speed = 25;

    expect(timeline.tick(3)).toHaveLength(0);
    expect(sim.getState().frame).toBe(0);
    expect(timeline.tick(1)).toHaveLength(1);
    expect(sim.getState().frame).toBe(1);
    expect(timeline.tick(4)).toHaveLength(1);
    expect(sim.getState().frame).toBe(2);
  });
});
