import type { FrameReport, InputFrame, SimState } from "../combat/types";
import {
  ContactKind,
  InputBit,
  StateId,
} from "../combat/types";
import { MoveId } from "../content/test-fighter";

export type TutorialLessonId =
  | "movement"
  | "defense"
  | "attacks"
  | "combo";

interface TutorialStep {
  objective: string;
  success: string;
}

interface TutorialLesson {
  id: TutorialLessonId;
  title: string;
  hint: string;
  steps: readonly TutorialStep[];
}

export interface TutorialSnapshot {
  active: boolean;
  lessonIndex: number;
  lessonCount: number;
  lessonId: TutorialLessonId;
  title: string;
  hint: string;
  objective: string;
  success: string;
  confirmation: string | null;
  stepIndex: number;
  stepCount: number;
  lessonComplete: boolean;
  tutorialComplete: boolean;
}

export const TUTORIAL_LESSONS: readonly TutorialLesson[] = [
  {
    id: "movement", title: "Move",
    hint: "A / D to walk. W to jump.",
    steps: [
      { objective: "Walk with A or D", success: "Walking complete" },
      { objective: "Jump with W", success: "Jump complete" },
    ],
  },
  {
    id: "attacks", title: "Attack",
    hint: "Use each arrow key in the four-button kit.",
    steps: [
      { objective: "Press ↑ / Y for Jab", success: "Jab started" },
      { objective: "Press ← / X for Sweep", success: "Sweep started" },
      { objective: "Press → / B for Overhead", success: "Overhead started" },
      { objective: "Press ↓ / A for Uppercut", success: "Uppercut started" },
    ],
  },
  {
    id: "defense", title: "Block",
    hint: "Hold A to block Jab. Hold A + S to block the low Sweep.",
    steps: [
      { objective: "Block the dummy’s Jab", success: "Jab blocked" },
      { objective: "Crouch-block the dummy’s Sweep", success: "Sweep blocked" },
    ],
  },
  {
    id: "combo", title: "Combo",
    hint: "Press ↑, then ← on hit, then ↓ on hit. If it drops, try again.",
    steps: [{ objective: "Land Jab → Sweep → Uppercut", success: "Combo complete" }],
  },
];

const ATTACK_MOVES = [MoveId.Jab, MoveId.Sweep, MoveId.Overhead, MoveId.Uppercut];
const COMBO_MOVES = [MoveId.Jab, MoveId.Sweep, MoveId.Uppercut];
const BLOCK_MOVES = [MoveId.Jab, MoveId.Sweep];

export class TutorialController {
  active = false;
  private lessonIndex = 0;
  private stepIndex = 0;
  private lessonComplete = false;
  private tutorialComplete = false;
  private dummyClock = 0;
  private comboHits = 0;
  private lastConfirmation: string | null = null;
  private resetRequested = false;
  private readonly onChange: (snapshot: TutorialSnapshot) => void;

  constructor(onChange: (snapshot: TutorialSnapshot) => void) {
    this.onChange = onChange;
  }

  start(lessonId?: TutorialLessonId): void {
    const requested = lessonId ?? "movement";
    const index = TUTORIAL_LESSONS.findIndex((lesson) => lesson.id === requested);
    this.active = true;
    this.lessonIndex = Math.max(0, index);
    this.stepIndex = 0;
    this.lessonComplete = false;
    this.tutorialComplete = false;
    this.dummyClock = 0;
    this.comboHits = 0;
    this.lastConfirmation = null;
    this.resetRequested = true;
    this.emit();
  }

  stop(): void {
    this.active = false;
    this.emit();
  }

  nextLesson(): void {
    if (!this.active || !this.lessonComplete) return;
    if (this.lessonIndex >= TUTORIAL_LESSONS.length - 1) {
      this.tutorialComplete = true;
      this.emit();
      return;
    }
    this.lessonIndex++;
    this.stepIndex = 0;
    this.lessonComplete = false;
    this.dummyClock = 0;
    this.comboHits = 0;
    this.lastConfirmation = null;
    this.resetRequested = true;
    this.emit();
  }

  observe(state: SimState, reports: readonly FrameReport[]): void {
    if (!this.active || this.lessonComplete || this.tutorialComplete) return;
    const lesson = TUTORIAL_LESSONS[this.lessonIndex];
    let success = false;

    if (lesson.id === "movement") success = movementSuccess(this.stepIndex, state);
    if (lesson.id === "attacks") success = moveStarted(reports, ATTACK_MOVES[this.stepIndex]);
    if (lesson.id === "combo") {
      if (state.fighters[1].comboCount === 0 && this.comboHits > 0) {
        this.comboHits = 0;
        this.resetRequested = true;
      }
      for (const contact of reports.flatMap((report) => report.contacts)) {
        if (contact.attacker !== 0 || contact.kind !== ContactKind.Hit) continue;
        this.comboHits = contact.moveId === COMBO_MOVES[this.comboHits]
          ? this.comboHits + 1
          : contact.moveId === MoveId.Jab ? 1 : 0;
      }
      success = this.comboHits === COMBO_MOVES.length && state.fighters[1].comboCount === 3;
    }
    if (lesson.id === "defense") {
      const contacts = reports.flatMap((report) => report.contacts).filter((contact) => contact.attacker === 1 && contact.defender === 0);
      success = contacts.some((contact) => contact.kind === ContactKind.Block && contact.moveId === BLOCK_MOVES[this.stepIndex]);
      if (contacts.length > 0) {
        this.dummyClock = 0;
        this.resetRequested = true;
      }
    }
    if (success) this.completeStep();
  }

  dummyInput(): InputFrame {
    if (!this.active || TUTORIAL_LESSONS[this.lessonIndex].id !== "defense" || this.lessonComplete) return 0;
    this.dummyClock++;
    const drillFrame = this.dummyClock % 110;
    if (drillFrame === 0) this.resetRequested = true;
    if (drillFrame !== 1) return 0;
    return this.stepIndex === 0 ? InputBit.Action1 : InputBit.Action2;
  }

  consumeResetRequest(): boolean {
    const requested = this.resetRequested;
    this.resetRequested = false;
    return requested;
  }

  snapshot(): TutorialSnapshot {
    const lesson = TUTORIAL_LESSONS[this.lessonIndex];
    const step = lesson.steps[Math.min(this.stepIndex, lesson.steps.length - 1)];
    return {
      active: this.active,
      lessonIndex: this.lessonIndex,
      lessonCount: TUTORIAL_LESSONS.length,
      lessonId: lesson.id,
      title: lesson.title,
      hint: lesson.hint,
      objective: step.objective,
      success: step.success,
      confirmation: this.lastConfirmation,
      stepIndex: this.stepIndex,
      stepCount: lesson.steps.length,
      lessonComplete: this.lessonComplete,
      tutorialComplete: this.tutorialComplete,
    };
  }

  private completeStep(): void {
    const lesson = TUTORIAL_LESSONS[this.lessonIndex];
    this.lastConfirmation = lesson.steps[this.stepIndex].success;
    if (this.stepIndex < lesson.steps.length - 1) {
      this.stepIndex++;
      this.dummyClock = 0;
      this.comboHits = 0;
    } else {
      this.lessonComplete = true;
      if (this.lessonIndex === TUTORIAL_LESSONS.length - 1) this.tutorialComplete = true;
    }
    this.emit();
  }

  private emit(): void {
    this.onChange(this.snapshot());
  }
}

function movementSuccess(step: number, state: SimState): boolean {
  const fighter = state.fighters[0];
  if (step === 0) return fighter.state === StateId.WalkForward || fighter.state === StateId.WalkBackward;
  return fighter.state === StateId.JumpSquat || fighter.airborne === 1;
}

function moveStarted(reports: readonly FrameReport[], moveId: number): boolean {
  return reports.some((report) => report.moveStarts.some((event) => event.player === 0 && event.moveId === moveId));
}

export function tutorialRequested(search: string): boolean {
  return new URLSearchParams(search).get("tutorial") === "1";
}
