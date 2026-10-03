import { Simulation } from "../../combat";
import type { FrameReport, InputFrame } from "../../combat";
import { SnapshotRing } from "../../rollback/snapshots/ring";
import { deserializeState, serializeState } from "../../rollback/snapshots/snapshot";

/** How fast the laboratory drives the simulation, as a percentage of real time. */
export type LabSpeed = 25 | 50 | 100 | 200;

/** `speed` is a percentage, so one whole simulation frame is worth 100 units. */
const SPEED_UNIT = 100;

/** Inputs handed to `step()` before anything has supplied a provider: everyone neutral. */
const NEUTRAL_INPUTS: readonly InputFrame[] = [];

/**
 * The laboratory's deterministic clock, rewind buffer, and event history.
 *
 * Every state is stored under the frame number it describes. Every input row is stored
 * under the frame on which it was consumed, and every report is stored under the frame
 * that produced it. Rewinding therefore restores the exact state, while moving forward
 * through already-recorded time reuses the original inputs instead of sampling whatever
 * happens to be held now. That is the distinction between a real scrubber and a reset
 * button wearing a `-1` label.
 */
export class Timeline {
  paused = false;
  pauseOnContact = false;
  speed: LabSpeed = 100;

  /** The report that produced the state currently being displayed, when one exists. */
  lastReport: FrameReport | null = null;

  /** A short operator-facing explanation of the latest timeline action. */
  lastMessage: string | null = null;

  /** Where inputs for a frame at the live edge come from. Set by the laboratory. */
  inputProvider: (frame: number) => readonly InputFrame[] = () => NEUTRAL_INPUTS;

  private readonly sim: Simulation;
  private readonly ring: SnapshotRing;
  private readonly slots = new Map<number, Uint8Array>();
  private readonly inputHistory = new Map<number, InputFrame[]>();
  private readonly reportHistory = new Map<number, FrameReport>();
  private accumulator = 0;
  private latestRecordedFrame: number;

  constructor(sim: Simulation, ringCapacity: number) {
    this.sim = sim;
    this.ring = new SnapshotRing(ringCapacity);
    this.latestRecordedFrame = sim.getState().frame;
    this.ring.save(sim.getState().frame, sim.getState());
  }

  /**
   * Advance by whole simulation frames derived from whole real frames. Remainders stay
   * integer, so slow motion never drifts. Contact can stop a multi-frame tick immediately,
   * leaving the resolved contact state and its report together on screen.
   */
  tick(realFramesElapsed: number): FrameReport[] {
    if (this.paused) {
      this.accumulator = 0;
      return [];
    }
    if (realFramesElapsed <= 0) return [];

    this.accumulator += realFramesElapsed * this.speed;
    const frames = Math.trunc(this.accumulator / SPEED_UNIT);
    this.accumulator -= frames * SPEED_UNIT;

    const reports: FrameReport[] = [];
    for (let i = 0; i < frames; i++) {
      const report = this.stepOnce();
      reports.push(report);
      if (this.pauseForContact(report)) break;
    }
    return reports;
  }

  /** Forward by `n` exact frames, or restore a snapshot when `n` is negative. */
  stepFrames(n: number): FrameReport[] {
    this.lastMessage = null;
    if (n === 0) return [];

    if (n > 0) {
      const reports: FrameReport[] = [];
      for (let i = 0; i < n; i++) {
        const report = this.stepOnce();
        reports.push(report);
        if (this.pauseForContact(report)) break;
      }
      return reports;
    }

    this.jumpToFrame(this.sim.getState().frame + n);
    return [];
  }

  /** Restore one exact state frame from the snapshot window. */
  jumpToFrame(target: number): boolean {
    this.lastMessage = null;
    if (!Number.isInteger(target) || target < 0) {
      this.lastMessage = `Frame ${target} is before the start of the match.`;
      return false;
    }

    const restored = this.ring.load(target);
    if (restored === null) {
      const oldest = this.ring.oldestFrame();
      this.lastMessage =
        oldest < 0
          ? `Frame ${target} is not in the snapshot ring.`
          : `Frame ${target} is outside the ${oldest}–${this.ring.newestFrame()} snapshot window.`;
      return false;
    }

    this.sim.setState(restored);
    this.lastReport = this.reportHistory.get(target - 1) ?? null;
    this.accumulator = 0;
    return true;
  }

  /** The report emitted while simulating `frame`, retained for inspectors and links. */
  reportAt(frame: number): FrameReport | null {
    return this.reportHistory.get(frame) ?? null;
  }

  /** Every retained report in frame order. */
  reports(throughFrame = this.sim.getState().frame): FrameReport[] {
    return [...this.reportHistory.values()]
      .filter((report) => report.frame < throughFrame)
      .sort((a, b) => a.frame - b.frame);
  }

  /** Only frames on which attack and hurt volumes resolved a hit or block. */
  contactReports(throughFrame = this.latestRecordedFrame): FrameReport[] {
    return this.reports(throughFrame + 1).filter((report) => report.contacts.length > 0);
  }

  /** Save the same canonical bytes used by rollback and determinism hashing. */
  saveState(slot: number): void {
    this.slots.set(slot, serializeState(this.sim.getState()));
  }

  loadState(slot: number): boolean {
    const bytes = this.slots.get(slot);
    if (bytes === undefined) return false;
    this.sim.setState(deserializeState(bytes));
    this.clearRunHistory();
    this.latestRecordedFrame = this.sim.getState().frame;
    this.ring.save(this.sim.getState().frame, this.sim.getState());
    return true;
  }

  /** Whether a slot currently holds anything, for enabling the load control. */
  hasSlot(slot: number): boolean {
    return this.slots.has(slot);
  }

  /** The span of state frames the scrubber can currently reach. */
  bufferedRange(): { oldest: number; newest: number } {
    return { oldest: this.ring.oldestFrame(), newest: this.ring.newestFrame() };
  }

  /** Back to the canonical initial state. Save-state slots survive. */
  reset(): void {
    this.sim.setState(Simulation.initialState(this.sim.config));
    this.clearRunHistory();
    this.latestRecordedFrame = this.sim.getState().frame;
    this.ring.save(this.sim.getState().frame, this.sim.getState());
  }

  private clearRunHistory(): void {
    this.ring.clear();
    this.inputHistory.clear();
    this.reportHistory.clear();
    this.lastReport = null;
    this.lastMessage = null;
    this.accumulator = 0;
  }

  private pauseForContact(report: FrameReport): boolean {
    if (!this.pauseOnContact || report.contacts.length === 0) return false;
    this.paused = true;
    this.accumulator = 0;
    this.lastMessage = `Contact on frame ${report.frame}. Simulation paused.`;
    return true;
  }

  /** Run exactly one frame, retaining the input, output report, and resulting state. */
  private stepOnce(): FrameReport {
    const frame = this.sim.getState().frame;
    const recorded = this.inputHistory.get(frame);
    const source = frame < this.latestRecordedFrame && recorded
      ? recorded
      : this.inputProvider(frame);
    const inputs = Array.from({ length: this.sim.getState().fighters.length }, (_, player) => source[player] ?? 0);

    this.inputHistory.set(frame, inputs);
    const report = this.sim.step(inputs);
    this.reportHistory.set(report.frame, report);
    this.lastReport = report;
    this.latestRecordedFrame = Math.max(this.latestRecordedFrame, this.sim.getState().frame);
    this.ring.save(this.sim.getState().frame, this.sim.getState());
    return report;
  }
}
