import { describe, expect, it } from "vitest";

import { InputBit, StateId } from "../../src/combat/types";
import { TUTORIAL_LESSONS, TutorialController } from "../../src/lab/tutorial";
import { createSim } from "../helpers/harness";

describe("interactive tutorial objectives", () => {
  it("uses the fixed-kit lesson flow without a modifier lesson", () => {
    expect(TUTORIAL_LESSONS.map((lesson) => lesson.id)).toEqual([
      "movement", "defense", "directions", "first-route", "status", "codex",
    ]);
  });

  it("advances movement only from authoritative fighter states", () => {
    const snapshots: ReturnType<TutorialController["snapshot"]>[] = [];
    const tutorial = new TutorialController((snapshot) => snapshots.push(snapshot));
    const state = createSim().getState();
    tutorial.start("movement");

    state.fighters[0].state = StateId.WalkForward;
    tutorial.observe(InputBit.Right, state, []);
    expect(tutorial.snapshot().stepIndex).toBe(1);

    state.fighters[0].state = StateId.WalkBackward;
    tutorial.observe(InputBit.Left, state, []);
    state.fighters[0].state = StateId.Crouch;
    tutorial.observe(InputBit.Down, state, []);
    state.fighters[0].state = StateId.JumpSquat;
    tutorial.observe(InputBit.Up, state, []);
    state.fighters[0].state = StateId.Dash;
    tutorial.observe(InputBit.Right, state, []);

    expect(tutorial.snapshot().lessonComplete).toBe(true);
    expect(tutorial.snapshot().completedLessons).toContain("movement");
    expect(snapshots.length).toBeGreaterThan(1);
  });

  it("does not pass a movement objective from elapsed time alone", () => {
    const tutorial = new TutorialController(() => undefined);
    const state = createSim().getState();
    tutorial.start("movement");
    for (let frame = 0; frame < 600; frame++) tutorial.observe(0, state, []);
    expect(tutorial.snapshot().stepIndex).toBe(0);
    expect(tutorial.snapshot().lessonComplete).toBe(false);
  });
});
