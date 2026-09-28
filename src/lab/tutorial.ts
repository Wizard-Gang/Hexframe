import type { FrameReport, InputFrame, SimState } from "../combat/types";
import {
  actionBit,
  ContactKind,
  HitLevel,
  InputBit,
  StateId,
} from "../combat/types";
import { MoveId } from "../content/test-fighter";

export type TutorialLessonId =
  | "movement"
  | "defense"
  | "attacks"
  | "combo"
  | "inspect";

export type TutorialUiEvent =
  | "debug-enabled"
  | "contact-paused"
  | "frame-stepped";

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
  telegraph: string | null;
  completedLessons: readonly TutorialLessonId[];
}

const STORAGE_KEY = "hexframe.tutorial.progress.v2";
const PROMPT_STORAGE_KEY = "hexframe.tutorial.prompt.v2";

export const TUTORIAL_LESSONS: readonly TutorialLesson[] = [
  {
    id: "movement",
    title: "Movement",
    hint: "Use the live movement controls. Each objective watches the authoritative fighter state.",
    steps: [
      { objective: "Move forward", success: "Forward movement complete" },
      { objective: "Move backward", success: "Backward movement complete" },
      { objective: "Crouch", success: "Crouch complete" },
      { objective: "Jump", success: "Jump complete" },
    ],
  },
  {
    id: "defense",
    title: "Defense",
    hint: "The dummy will attack mid, low, then overhead. Hold away; add down for the low.",
    steps: [
      { objective: "Block the telegraphed mid", success: "Mid blocked" },
      { objective: "Crouch-block the telegraphed low", success: "Low blocked" },
      { objective: "Stand-block the telegraphed overhead", success: "Overhead blocked" },
    ],
  },
  {
    id: "attacks",
    title: "Attacks",
    hint: "Use each button in the fixed four-button kit.",
    steps: [
      { objective: "Press ↑ / Y for Ember Palm", success: "Ember Palm started" },
      { objective: "Press ← / X for Ashen Sweep", success: "Ashen Sweep started" },
      { objective: "Press → / B for Frost Heel", success: "Frost Heel started" },
      { objective: "Press ↓ / A for Phoenix Drive", success: "Phoenix Drive started" },
    ],
  },
  {
    id: "combo",
    title: "Combo",
    hint: "Cancel on contact: Ember Palm → Ashen Sweep → Phoenix Drive.",
    steps: [
      { objective: "Land Ember Palm", success: "Starter connected" },
      { objective: "Cancel into Ashen Sweep", success: "Link connected" },
      { objective: "Cash out with Phoenix Drive", success: "Combo complete" },
    ],
  },
  {
    id: "inspect",
    title: "Inspect",
    hint: "Use the same on-screen Debug tools available in normal Training.",
    steps: [
      { objective: "Turn on Debug", success: "Debug enabled" },
      { objective: "Enable Pause on contact, then land an attack", success: "Contact paused" },
      { objective: "Step forward one frame", success: "Frame stepped" },
    ],
  },
];

const ATTACK_MOVES = [MoveId.EmberPalm, MoveId.AshenSweep, MoveId.FrostHeel, MoveId.PhoenixDrive];
const COMBO_MOVES = [MoveId.EmberPalm, MoveId.AshenSweep, MoveId.PhoenixDrive];
const DEFENSE_LEVELS = [HitLevel.Mid, HitLevel.Low, HitLevel.Overhead];
const INSPECT_EVENTS: readonly TutorialUiEvent[] = ["debug-enabled", "contact-paused", "frame-stepped"];

export class TutorialController {
  active = false;
  private lessonIndex = 0;
  private stepIndex = 0;
  private lessonComplete = false;
  private tutorialComplete = false;
  private dummyClock = 0;
  private comboClock = 0;
  private lastConfirmation: string | null = null;
  private resetRequested = false;
  private readonly completed = loadCompletedLessons();
  private readonly onChange: (snapshot: TutorialSnapshot) => void;
  private readonly defenseActions: readonly [number, number, number];

  constructor(
    onChange: (snapshot: TutorialSnapshot) => void,
    defenseActions: readonly [number, number, number] = [actionBit(0), actionBit(1), actionBit(2)],
  ) {
    this.onChange = onChange;
    this.defenseActions = defenseActions;
  }

  start(lessonId?: TutorialLessonId): void {
    const requested = lessonId ?? this.firstIncompleteLesson();
    const index = TUTORIAL_LESSONS.findIndex((lesson) => lesson.id === requested);
    this.active = true;
    this.lessonIndex = Math.max(0, index);
    this.stepIndex = 0;
    this.lessonComplete = false;
    this.tutorialComplete = false;
    this.dummyClock = 0;
    this.comboClock = 0;
    this.lastConfirmation = null;
    this.resetRequested = true;
    this.emit();
  }

  restart(): void {
    this.completed.clear();
    persistCompletedLessons(this.completed);
    this.start("movement");
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
    this.comboClock = 0;
    this.lastConfirmation = null;
    this.resetRequested = true;
    this.emit();
  }

  observe(_input: InputFrame, state: SimState, reports: readonly FrameReport[]): void {
    if (!this.active || this.lessonComplete || this.tutorialComplete) return;
    const lesson = TUTORIAL_LESSONS[this.lessonIndex];
    let success = false;

    if (lesson.id === "movement") success = movementSuccess(this.stepIndex, state);
    if (lesson.id === "attacks") success = moveStarted(reports, ATTACK_MOVES[this.stepIndex]);
    if (lesson.id === "combo") {
      success = moveConnected(reports, COMBO_MOVES[this.stepIndex]);
      if (this.stepIndex > 0) {
        this.comboClock++;
        if (!success && this.comboClock > 120) {
          this.stepIndex = 0;
          this.comboClock = 0;
          this.lastConfirmation = null;
          this.resetRequested = true;
          this.emit();
        }
      }
    }
    if (lesson.id === "defense") {
      const contacts = reports.flatMap((report) => report.contacts).filter((contact) => contact.attacker === 1 && contact.defender === 0);
      success = contacts.some((contact) => contact.kind === ContactKind.Block && contact.level === DEFENSE_LEVELS[this.stepIndex]);
      if (contacts.length > 0) {
        this.dummyClock = 0;
        this.resetRequested = true;
      }
    }
    if (success) this.completeStep();
  }

  recordUi(event: TutorialUiEvent): void {
    if (!this.active || this.lessonComplete || this.tutorialComplete) return;
    const lesson = TUTORIAL_LESSONS[this.lessonIndex];
    if (lesson.id === "inspect" && INSPECT_EVENTS[this.stepIndex] === event) this.completeStep();
  }

  dummyInput(_state: SimState): InputFrame {
    if (!this.active || TUTORIAL_LESSONS[this.lessonIndex].id !== "defense" || this.lessonComplete) return 0;
    this.dummyClock++;
    const drillFrame = this.dummyClock % 110;
    if (drillFrame !== 1) return 0;
    return this.defenseActions[this.stepIndex] ?? 0;
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
      telegraph: lesson.id === "defense" && !this.lessonComplete
        ? `${["MID", "LOW", "OVERHEAD"][this.stepIndex]} · HOLD THE REQUIRED GUARD`
        : null,
      completedLessons: [...this.completed],
    };
  }

  private firstIncompleteLesson(): TutorialLessonId {
    return TUTORIAL_LESSONS.find((lesson) => !this.completed.has(lesson.id))?.id ?? "movement";
  }

  private completeStep(): void {
    const lesson = TUTORIAL_LESSONS[this.lessonIndex];
    this.lastConfirmation = lesson.steps[this.stepIndex].success;
    if (this.stepIndex < lesson.steps.length - 1) {
      this.stepIndex++;
      this.dummyClock = 0;
      this.comboClock = 0;
    } else {
      this.lessonComplete = true;
      this.completed.add(lesson.id);
      persistCompletedLessons(this.completed);
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
  if (step === 0) return fighter.state === StateId.WalkForward;
  if (step === 1) return fighter.state === StateId.WalkBackward;
  if (step === 2) return fighter.state === StateId.Crouch;
  return fighter.state === StateId.JumpSquat || fighter.airborne === 1;
}

function moveStarted(reports: readonly FrameReport[], moveId: number): boolean {
  return reports.some((report) => report.moveStarts.some((event) => event.player === 0 && event.moveId === moveId));
}

function moveConnected(reports: readonly FrameReport[], moveId: number): boolean {
  return reports.some((report) => report.contacts.some((contact) => contact.attacker === 0 && contact.moveId === moveId && contact.kind === ContactKind.Hit));
}

function loadCompletedLessons(): Set<TutorialLessonId> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(value)) return new Set();
    const valid = new Set(TUTORIAL_LESSONS.map((lesson) => lesson.id));
    return new Set(value.filter((id): id is TutorialLessonId => typeof id === "string" && valid.has(id as TutorialLessonId)));
  } catch {
    return new Set();
  }
}

function persistCompletedLessons(completed: ReadonlySet<TutorialLessonId>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...completed]));
  } catch {
    // Tutorial progress remains valid for the current session when storage is unavailable.
  }
}

export function tutorialPromptSeen(): boolean {
  try {
    return localStorage.getItem(PROMPT_STORAGE_KEY) === "true";
  } catch {
    return true;
  }
}

export function markTutorialPromptSeen(): void {
  try {
    localStorage.setItem(PROMPT_STORAGE_KEY, "true");
  } catch {
    // The first-visit choice is session-only when storage is unavailable.
  }
}

export function tutorialRequested(search: string): boolean {
  return new URLSearchParams(search).get("tutorial") === "1";
}
