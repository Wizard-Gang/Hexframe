import { describe, expect, it } from "vitest";

import { cancelAllowed } from "../../src/combat/commands/resolve";
import { InputBit } from "../../src/combat/types";
import { MoveId, TEST_FIGHTER } from "../../src/content/test-fighter";
import {
  TUTORIAL_LESSONS,
  TutorialController,
  tutorialRequested,
} from "../../src/lab/tutorial";
import { createSim, placeFighters } from "../helpers/harness";

function observeFrame(tutorial: TutorialController, sim: ReturnType<typeof createSim>, playerInput: number, dummyInput = 0): void {
  const report = sim.step([playerInput, dummyInput]);
  tutorial.observe(sim.getState(), [report]);
}

function expectNoIdleProgress(tutorial: TutorialController): void {
  const before = tutorial.snapshot();
  const state = createSim().getState();
  for (let frame = 0; frame < 600; frame++) tutorial.observe(state, []);
  expect(tutorial.snapshot()).toEqual(before);
}

function driveMovement(tutorial: TutorialController, sim: ReturnType<typeof createSim>, input: number): void {
  expectNoIdleProgress(tutorial);
  const before = tutorial.snapshot().stepIndex;
  for (let frame = 0; frame < 40 && tutorial.snapshot().stepIndex === before; frame++) {
    observeFrame(tutorial, sim, input);
  }
  expect(tutorial.snapshot().stepIndex !== before || tutorial.snapshot().lessonComplete).toBe(true);
}

describe("interactive tutorial objectives", () => {
  it("completes every lesson in order from live simulation inputs", () => {
    expect(TUTORIAL_LESSONS.map((lesson) => lesson.title)).toEqual(["Move", "Attack", "Block", "Combo"]);
    expect(TUTORIAL_LESSONS.reduce((total, lesson) => total + lesson.steps.length, 0)).toBe(9);
    const tutorial = new TutorialController(() => undefined);
    tutorial.start("movement");
    tutorial.consumeResetRequest();
    let sim = createSim();
    placeFighters(sim, -18, 18);

    driveMovement(tutorial, sim, InputBit.Right);
    driveMovement(tutorial, sim, InputBit.Up);
    expect(tutorial.snapshot().lessonComplete).toBe(true);

    tutorial.nextLesson();
    expect(tutorial.snapshot().lessonId).toBe("attacks");
    tutorial.consumeResetRequest();
    sim = createSim();
    placeFighters(sim, -18, 18);

    for (const action of [InputBit.Action1, InputBit.Action2, InputBit.Action3, InputBit.Action4]) {
      expectNoIdleProgress(tutorial);
      const before = tutorial.snapshot().stepIndex;
      observeFrame(tutorial, sim, action);
      expect(tutorial.snapshot().stepIndex !== before || tutorial.snapshot().lessonComplete).toBe(true);
      for (let frame = 0; frame < 90; frame++) observeFrame(tutorial, sim, 0);
    }
    expect(tutorial.snapshot().lessonComplete).toBe(true);

    tutorial.nextLesson();
    expect(tutorial.snapshot().lessonId).toBe("defense");
    tutorial.consumeResetRequest();
    sim = createSim();
    placeFighters(sim, -18, 18);

    while (!tutorial.snapshot().lessonComplete) {
      expectNoIdleProgress(tutorial);
      const step = tutorial.snapshot().stepIndex;
      const guard = step === 1 ? InputBit.Left | InputBit.Down : InputBit.Left;
      let advanced = false;
      for (let frame = 0; frame < 180 && !advanced; frame++) {
        const dummyInput = tutorial.dummyInput();
        observeFrame(tutorial, sim, guard, dummyInput);
        advanced = tutorial.snapshot().stepIndex !== step || tutorial.snapshot().lessonComplete;
        if (tutorial.consumeResetRequest()) {
          sim = createSim();
          placeFighters(sim, -18, 18);
        }
      }
      expect(advanced).toBe(true);
    }

    tutorial.nextLesson();
    expect(tutorial.snapshot().lessonId).toBe("combo");
    tutorial.consumeResetRequest();
    sim = createSim();
    placeFighters(sim, -18, 18);
    expectNoIdleProgress(tutorial);
    let opening = true;
    let sweepQueued = false;
    let uppercutQueued = false;

    for (let frame = 0; frame < 240 && !tutorial.snapshot().lessonComplete; frame++) {
      const fighter = sim.getState().fighters[0];
      let input = 0;
      if (opening) {
        input = InputBit.Action1;
        opening = false;
      } else if (!sweepQueued && fighter.hitstop === 0 && cancelAllowed(fighter, TEST_FIGHTER, MoveId.Sweep)) {
        input = InputBit.Action2;
        sweepQueued = true;
      } else if (!uppercutQueued && fighter.hitstop === 0 && cancelAllowed(fighter, TEST_FIGHTER, MoveId.Uppercut)) {
        input = InputBit.Action4;
        uppercutQueued = true;
      }
      observeFrame(tutorial, sim, input);
    }
    expect(tutorial.snapshot().lessonComplete).toBe(true);

    expect(tutorial.snapshot().tutorialComplete).toBe(true);

    tutorial.stop();
    expect(tutorial.snapshot().active).toBe(false);

    tutorial.start();
    expect(tutorial.snapshot()).toMatchObject({
      active: true,
      lessonId: "movement",
      title: "Move",
      stepIndex: 0,
      tutorialComplete: false,
    });
  });

  it("starts the tutorial only from the explicit query", () => {
    expect(tutorialRequested("?tutorial=1")).toBe(true);
    expect(tutorialRequested("?tutorial=0")).toBe(false);
    expect(tutorialRequested("")).toBe(false);
  });
});
