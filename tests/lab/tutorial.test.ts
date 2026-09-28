import { afterEach, describe, expect, it } from "vitest";

import { cancelAllowed } from "../../src/combat/commands/resolve";
import { InputBit, StateId } from "../../src/combat/types";
import { MoveId, TEST_FIGHTER } from "../../src/content/test-fighter";
import {
  markTutorialPromptSeen,
  TUTORIAL_LESSONS,
  TutorialController,
  tutorialPromptSeen,
  tutorialRequested,
} from "../../src/lab/tutorial";
import { createSim, placeFighters } from "../helpers/harness";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

function installStorage(): MemoryStorage {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  return storage;
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "localStorage");
});

function observeFrame(tutorial: TutorialController, sim: ReturnType<typeof createSim>, playerInput: number, dummyInput = 0): void {
  const report = sim.step([playerInput, dummyInput]);
  tutorial.observe(playerInput, sim.getState(), [report]);
}

function driveMovement(tutorial: TutorialController, sim: ReturnType<typeof createSim>, input: number): void {
  const before = tutorial.snapshot().stepIndex;
  for (let frame = 0; frame < 40 && tutorial.snapshot().stepIndex === before; frame++) {
    observeFrame(tutorial, sim, input);
  }
  expect(tutorial.snapshot().stepIndex !== before || tutorial.snapshot().lessonComplete).toBe(true);
}

describe("interactive tutorial objectives", () => {
  it("uses only the five Training MVP lessons", () => {
    expect(TUTORIAL_LESSONS.map((lesson) => lesson.id)).toEqual([
      "movement", "defense", "attacks", "combo", "inspect",
    ]);
  });

  it("completes every lesson in order from live simulation inputs and authored UI events", () => {
    const tutorial = new TutorialController(() => undefined);
    tutorial.start("movement");
    let sim = createSim();
    placeFighters(sim, -18, 18);

    driveMovement(tutorial, sim, InputBit.Right);
    driveMovement(tutorial, sim, InputBit.Left);
    driveMovement(tutorial, sim, InputBit.Down);
    driveMovement(tutorial, sim, InputBit.Up);
    expect(tutorial.snapshot().lessonComplete).toBe(true);

    tutorial.nextLesson();
    expect(tutorial.snapshot().lessonId).toBe("defense");
    tutorial.consumeResetRequest();
    sim = createSim();
    placeFighters(sim, -18, 18);

    while (!tutorial.snapshot().lessonComplete) {
      const step = tutorial.snapshot().stepIndex;
      const guard = step === 1 ? InputBit.Left | InputBit.Down : InputBit.Left;
      let advanced = false;
      for (let frame = 0; frame < 180 && !advanced; frame++) {
        const dummyInput = tutorial.dummyInput(sim.getState());
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
    expect(tutorial.snapshot().lessonId).toBe("attacks");
    tutorial.consumeResetRequest();
    sim = createSim();
    placeFighters(sim, -18, 18);

    for (const action of [InputBit.Action1, InputBit.Action2, InputBit.Action3, InputBit.Action4]) {
      const before = tutorial.snapshot().stepIndex;
      observeFrame(tutorial, sim, action);
      expect(tutorial.snapshot().stepIndex !== before || tutorial.snapshot().lessonComplete).toBe(true);
      for (let frame = 0; frame < 90; frame++) observeFrame(tutorial, sim, 0);
    }
    expect(tutorial.snapshot().lessonComplete).toBe(true);

    tutorial.nextLesson();
    expect(tutorial.snapshot().lessonId).toBe("combo");
    tutorial.consumeResetRequest();
    sim = createSim();
    placeFighters(sim, -18, 18);
    let opening = true;
    let ashenQueued = false;
    let phoenixQueued = false;

    for (let frame = 0; frame < 240 && !tutorial.snapshot().lessonComplete; frame++) {
      const fighter = sim.getState().fighters[0];
      let input = 0;
      if (opening) {
        input = InputBit.Action1;
        opening = false;
      } else if (!ashenQueued && fighter.hitstop === 0 && cancelAllowed(fighter, TEST_FIGHTER, MoveId.AshenSweep)) {
        input = InputBit.Action2;
        ashenQueued = true;
      } else if (!phoenixQueued && fighter.hitstop === 0 && cancelAllowed(fighter, TEST_FIGHTER, MoveId.PhoenixDrive)) {
        input = InputBit.Action4;
        phoenixQueued = true;
      }
      observeFrame(tutorial, sim, input);
    }
    expect(tutorial.snapshot().lessonComplete).toBe(true);

    tutorial.nextLesson();
    expect(tutorial.snapshot().lessonId).toBe("inspect");
    tutorial.recordUi("frame-stepped");
    expect(tutorial.snapshot().stepIndex).toBe(0);
    tutorial.recordUi("debug-enabled");
    expect(tutorial.snapshot().stepIndex).toBe(1);
    tutorial.recordUi("frame-stepped");
    expect(tutorial.snapshot().stepIndex).toBe(1);
    tutorial.recordUi("contact-paused");
    expect(tutorial.snapshot().stepIndex).toBe(2);
    tutorial.recordUi("frame-stepped");

    expect(tutorial.snapshot().lessonComplete).toBe(true);
    expect(tutorial.snapshot().tutorialComplete).toBe(true);
    expect(tutorial.snapshot().completedLessons).toEqual([
      "movement", "defense", "attacks", "combo", "inspect",
    ]);
  });

  it("does not pass any lesson from elapsed time alone", () => {
    for (const lesson of TUTORIAL_LESSONS) {
      const tutorial = new TutorialController(() => undefined);
      const state = createSim().getState();
      tutorial.start(lesson.id);
      tutorial.consumeResetRequest();
      for (let frame = 0; frame < 600; frame++) tutorial.observe(0, state, []);
      expect(tutorial.snapshot().stepIndex, lesson.id).toBe(0);
      expect(tutorial.snapshot().lessonComplete, lesson.id).toBe(false);
    }
  });

  it("requires ordered inspect actions and remains coherent across repeated Debug state", () => {
    const tutorial = new TutorialController(() => undefined);
    tutorial.start("inspect");
    tutorial.recordUi("contact-paused");
    expect(tutorial.snapshot().stepIndex).toBe(0);
    tutorial.recordUi("debug-enabled");
    tutorial.recordUi("debug-enabled");
    expect(tutorial.snapshot().stepIndex).toBe(1);
    tutorial.recordUi("frame-stepped");
    expect(tutorial.snapshot().stepIndex).toBe(1);
    tutorial.recordUi("contact-paused");
    tutorial.recordUi("frame-stepped");
    expect(tutorial.snapshot().tutorialComplete).toBe(true);
  });

  it("persists completed lesson progress and restart clears it", () => {
    installStorage();
    const tutorial = new TutorialController(() => undefined);
    const state = createSim().getState();
    tutorial.start("movement");
    state.fighters[0].state = StateId.WalkForward;
    tutorial.observe(InputBit.Right, state, []);
    state.fighters[0].state = StateId.WalkBackward;
    tutorial.observe(InputBit.Left, state, []);
    state.fighters[0].state = StateId.Crouch;
    tutorial.observe(InputBit.Down, state, []);
    state.fighters[0].state = StateId.JumpSquat;
    tutorial.observe(InputBit.Up, state, []);
    expect(tutorial.snapshot().lessonComplete).toBe(true);

    const resumed = new TutorialController(() => undefined);
    resumed.start();
    expect(resumed.snapshot().lessonId).toBe("defense");
    resumed.restart();
    expect(resumed.snapshot().lessonId).toBe("movement");
    expect(resumed.snapshot().completedLessons).toEqual([]);
  });

  it("keeps the first-visit prompt and tutorial query contracts device-local and explicit", () => {
    installStorage();
    expect(tutorialPromptSeen()).toBe(false);
    markTutorialPromptSeen();
    expect(tutorialPromptSeen()).toBe(true);
    expect(tutorialRequested("?tutorial=1")).toBe(true);
    expect(tutorialRequested("?debug=1")).toBe(false);
    expect(tutorialRequested("")).toBe(false);
  });
});
