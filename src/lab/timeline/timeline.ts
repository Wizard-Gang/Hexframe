import { Simulation } from "../../combat";
import type { FrameReport, InputFrame } from "../../combat";

/** How fast the laboratory drives the simulation, as a percentage of real time. */
export type LabSpeed = 25 | 50 | 100 | 200;

/** `speed` is a percentage, so one whole simulation frame is worth 100 units. */
const SPEED_UNIT = 100;

/** Inputs handed to `step()` before anything has supplied a provider: everyone neutral. */
const NEUTRAL_INPUTS: readonly InputFrame[] = [];

/** The laboratory's forward-only deterministic clock and event history. */
export class Timeline {
  paused = false;
  pauseOnContact = false;
  speed: LabSpeed = 100;

  /** The report that produced the state currently being displayed, when one exists. */
  lastReport: FrameReport | null = null;

  /** A short operator-facing explanation of the latest timeline action. */
  lastMessage: string | null = null;

  /** Where inputs for the next frame come from. Set by the laboratory. */
  inputProvider: (frame: number) => readonly InputFrame[] = () => NEUTRAL_INPUTS;

  private readonly sim: Simulation;
  private readonly reportHistory = new Map<number, FrameReport>();
  private accumulator = 0;

  constructor(sim: Simulation) {
    this.sim = sim;
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

  /** Advance by an exact positive number of simulation frames. */
  stepFrames(count: number): FrameReport[] {
    this.lastMessage = null;
    if (!Number.isInteger(count) || count <= 0) return [];

    const reports: FrameReport[] = [];
    for (let i = 0; i < count; i++) {
      const report = this.stepOnce();
      reports.push(report);
      if (this.pauseForContact(report)) break;
    }
    return reports;
  }

  /** The report emitted while simulating `frame`, retained for contact history. */
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
  contactReports(throughFrame = this.sim.getState().frame): FrameReport[] {
    return this.reports(throughFrame).filter((report) => report.contacts.length > 0);
  }

  /** Back to the canonical initial state and clear the current run's event history. */
  reset(): void {
    this.sim.setState(Simulation.initialState(this.sim.config));
    this.clearRunHistory();
  }

  private clearRunHistory(): void {
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

  /** Run exactly one frame and retain its report for Debug contact history. */
  private stepOnce(): FrameReport {
    const frame = this.sim.getState().frame;
    const source = this.inputProvider(frame);
    const inputs = Array.from({ length: this.sim.getState().fighters.length }, (_, player) => source[player] ?? 0);
    const report = this.sim.step(inputs);
    this.reportHistory.set(report.frame, report);
    this.lastReport = report;
    return report;
  }
}
