import type { FrameReport, InputFrame, SimState } from "../combat/types";
import {
  actionBit,
  ContactKind,
  DebuffEventKind,
  DebuffKind,
  HitLevel,
  InputBit,
  StateId,
} from "../combat/types";
import { MoveId } from "../content/test-fighter";

export type TutorialLessonId =
  | "movement"
  | "defense"
  | "directions"
  | "modifiers"
  | "first-route"
  | "status"
  | "arsenal"
  | "codex";

export type TutorialUiEvent =
  | "arsenal-opened"
  | "move-replaced"
  | "returned-to-combat"
  | "replacement-used"
  | "codex-opened"
  | "demo-played"
  | "demo-mode-changed"
  | "demo-scrubbed"
  | "route-inspected";

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

const STORAGE_KEY = "hexframe.tutorial.v1";

export const TUTORIAL_LESSONS: readonly TutorialLesson[] = [
  {
    id: "movement",
    title: "Movement",
    hint: "Complete each action in the real arena.",
    steps: [
      { objective: "Move forward", success: "Forward movement complete" },
      { objective: "Move backward", success: "Backward movement complete" },
      { objective: "Crouch", success: "Crouch complete" },
      { objective: "Jump", success: "Jump complete" },
      { objective: "Double-tap a direction to dash", success: "Dash complete" },
    ],
  },
  {
    id: "defense",
    title: "Defense",
    hint: "Hold away. Add down for a low; stand for an overhead.",
    steps: [
      { objective: "Block the telegraphed mid", success: "Mid blocked" },
      { objective: "Crouch-block the low", success: "Low blocked" },
      { objective: "Stand-block the overhead", success: "Overhead blocked" },
    ],
  },
  {
    id: "directions",
    title: "Four attack directions",
    hint: "The arrow-key diamond mirrors Y / X / B / A.",
    steps: [
      { objective: "Press ↑ / Y for the Fire starter", success: "Ember Palm started" },
      { objective: "Press ← / X for the Poison starter", success: "Venom Fang started" },
      { objective: "Press → / B for the Freeze starter", success: "Frost Heel started" },
      { objective: "Press ↓ / A for the Shock starter", success: "Storm Knuckle started" },
    ],
  },
  {
    id: "modifiers",
    title: "Modifier banks",
    hint: "Stay on one direction. The modifier advances that route.",
    steps: [
      { objective: "Press ↑ / Y — Starter", success: "Starter ready" },
      { objective: "Press LT + ↑ / Shift + ↑ — Link", success: "Link ready" },
      { objective: "Press RT + ↑ / Ctrl/⌘ + ↑ — Cashout", success: "Cashout ready" },
    ],
  },
  {
    id: "first-route",
    title: "Your first route",
    hint: "Cancel on contact: Starter → Link → Cashout.",
    steps: [
      { objective: "Land Ember Palm", success: "Starter connected" },
      { objective: "Cancel into Ashen Sweep", success: "Link connected" },
      { objective: "Cash out with Phoenix Drive", success: "Route complete" },
    ],
  },
  {
    id: "status",
    title: "Status payoff",
    hint: "Repeat the Fire route and watch Burn prime, stack, and cash out.",
    steps: [
      { objective: "Apply Burn with a Fire technique", success: "Burn applied" },
      { objective: "Finish with Phoenix Drive", success: "Status route complete" },
    ],
  },
  {
    id: "arsenal",
    title: "Arsenal",
    hint: "Follow the lesson steps in order.",
    steps: [
      { objective: "Open Arsenal", success: "Arsenal opened" },
      { objective: "Replace one technique", success: "Technique replaced" },
      { objective: "Return to combat", success: "Build applied" },
      { objective: "Use the replacement", success: "Replacement tested" },
    ],
  },
  {
    id: "codex",
    title: "Codex",
    hint: "The demonstration is a deterministic mini-match using the same engine.",
    steps: [
      { objective: "Open Moves in the Codex", success: "Move selected" },
      { objective: "Play the demonstration", success: "Demonstration played" },
      { objective: "Switch Hit / Block", success: "Scenario changed" },
      { objective: "Scrub one frame", success: "Frame inspected" },
      { objective: "Inspect or equip its route", success: "Codex complete" },
    ],
  },
];

const DIRECTION_MOVES = [MoveId.EmberPalm, MoveId.VenomFang, MoveId.FrostHeel, MoveId.StormKnuckle];
const MODIFIER_MOVES = [MoveId.EmberPalm, MoveId.AshenSweep, MoveId.PhoenixDrive];
const ROUTE_MOVES = [MoveId.EmberPalm, MoveId.AshenSweep, MoveId.PhoenixDrive];
const DEFENSE_LEVELS = [HitLevel.Mid, HitLevel.Low, HitLevel.Overhead];

export class TutorialController {
  active = false;
  private lessonIndex = 0;
  private stepIndex = 0;
  private lessonComplete = false;
  private tutorialComplete = false;
  private dummyClock = 0;
  private routeClock = 0;
  private lastConfirmation: string | null = null;
  private resetRequested = false;
  private readonly completed = loadCompletedLessons();
  private readonly onChange: (snapshot: TutorialSnapshot) => void;
  private readonly defenseActions: readonly [number, number, number];

  constructor(
    onChange: (snapshot: TutorialSnapshot) => void,
    defenseActions: readonly [number, number, number] = [actionBit(0), actionBit(4), actionBit(2)],
  ) {
    this.onChange = onChange;
    this.defenseActions = defenseActions;
  }

  start(lessonId: TutorialLessonId = "movement"): void {
    const index = TUTORIAL_LESSONS.findIndex((lesson) => lesson.id === lessonId);
    this.active = true;
    this.lessonIndex = Math.max(0, index);
    this.stepIndex = 0;
    this.lessonComplete = false;
    this.tutorialComplete = false;
    this.dummyClock = 0;
    this.routeClock = 0;
    this.lastConfirmation = null;
    this.emit();
  }

  stop(): void {
    this.active = false;
    this.emit();
  }

  nextLesson(): void {
    if (!this.active) return;
    if (this.lessonIndex >= TUTORIAL_LESSONS.length - 1) {
      this.tutorialComplete = true;
      this.emit();
      return;
    }
    this.lessonIndex++;
    this.stepIndex = 0;
    this.lessonComplete = false;
    this.dummyClock = 0;
    this.routeClock = 0;
    this.lastConfirmation = null;
    this.resetRequested = true;
    this.emit();
  }

  skipLesson(): void {
    this.lessonComplete = true;
    this.nextLesson();
  }

  observe(input: InputFrame, state: SimState, reports: readonly FrameReport[]): void {
    if (!this.active || this.lessonComplete || this.tutorialComplete) return;
    const lesson = TUTORIAL_LESSONS[this.lessonIndex];
    let success = false;

    if (lesson.id === "movement") success = movementSuccess(this.stepIndex, input, state);
    if (lesson.id === "directions") success = moveStarted(reports, DIRECTION_MOVES[this.stepIndex]);
    if (lesson.id === "modifiers") success = moveStarted(reports, MODIFIER_MOVES[this.stepIndex]);
    if (lesson.id === "first-route") {
      success = moveConnected(reports, ROUTE_MOVES[this.stepIndex]);
      if (this.stepIndex > 0) {
        this.routeClock++;
        if (!success && this.routeClock > 120) {
          this.stepIndex = 0;
          this.routeClock = 0;
          this.lastConfirmation = null;
          this.resetRequested = true;
          this.emit();
        }
      }
    }
    if (lesson.id === "status") {
      success = this.stepIndex === 0
        ? reports.some((report) => report.debuffs.some((event) => event.source === 0 && event.target === 1 && event.debuff === DebuffKind.Burn && event.kind === DebuffEventKind.Applied))
        : moveConnected(reports, MoveId.PhoenixDrive);
    }
    if (lesson.id === "defense") {
      const contacts = reports.flatMap((report) => report.contacts).filter((contact) => contact.attacker === 1 && contact.defender === 0);
      success = contacts.some((contact) => contact.kind === ContactKind.Block && contact.level === DEFENSE_LEVELS[this.stepIndex]);
      if (contacts.length > 0) {
        this.dummyClock = 0;
        this.resetRequested = true;
      }
    }
    if (lesson.id === "arsenal" && this.stepIndex === 3) {
      success = reports.some((report) => report.moveStarts.some((event) => event.player === 0));
    }
    if (success) this.completeStep();
  }

  recordUi(event: TutorialUiEvent): void {
    if (!this.active || this.lessonComplete) return;
    const lesson = TUTORIAL_LESSONS[this.lessonIndex];
    const expected: Partial<Record<TutorialLessonId, readonly TutorialUiEvent[]>> = {
      arsenal: ["arsenal-opened", "move-replaced", "returned-to-combat"],
      codex: ["codex-opened", "demo-played", "demo-mode-changed", "demo-scrubbed", "route-inspected"],
    };
    if (expected[lesson.id]?.[this.stepIndex] === event) this.completeStep();
  }

  dummyInput(state: SimState): InputFrame {
    if (!this.active || TUTORIAL_LESSONS[this.lessonIndex].id !== "defense" || this.lessonComplete) return 0;
    this.dummyClock++;
    const drillFrame = this.dummyClock % 110;
    if (drillFrame !== 52) return 0;
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
        ? `${["MID", "LOW", "OVERHEAD"][this.stepIndex]} IN ${Math.max(1, Math.ceil((52 - (this.dummyClock % 110)) / 30))}`
        : null,
      completedLessons: [...this.completed],
    };
  }

  private completeStep(): void {
    const lesson = TUTORIAL_LESSONS[this.lessonIndex];
    this.lastConfirmation = lesson.steps[this.stepIndex].success;
    if (this.stepIndex < lesson.steps.length - 1) {
      this.stepIndex++;
      this.dummyClock = 0;
      this.routeClock = 0;
    } else {
      this.lessonComplete = true;
      this.completed.add(lesson.id);
      persistCompletedLessons(this.completed);
    }
    this.emit();
  }

  private emit(): void {
    this.onChange(this.snapshot());
  }
}

function movementSuccess(step: number, input: InputFrame, state: SimState): boolean {
  const fighter = state.fighters[0];
  if (step === 0) return fighter.state === StateId.WalkForward;
  if (step === 1) return fighter.state === StateId.WalkBackward;
  if (step === 2) return fighter.state === StateId.Crouch;
  if (step === 3) return fighter.state === StateId.JumpSquat || fighter.airborne === 1;
  return fighter.state === StateId.Dash && (input & (InputBit.Left | InputBit.Right)) !== 0;
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
    localStorage.setItem("hexframe.tutorial.seen.v1", "true");
  } catch {
    // Tutorial progress remains valid for the current session when storage is unavailable.
  }
}

export function tutorialSeen(): boolean {
  try {
    return localStorage.getItem("hexframe.tutorial.seen.v1") === "true";
  } catch {
    return true;
  }
}

export function markTutorialSeen(): void {
  try {
    localStorage.setItem("hexframe.tutorial.seen.v1", "true");
  } catch {
    // The first-launch choice is session-only when storage is unavailable.
  }
}
