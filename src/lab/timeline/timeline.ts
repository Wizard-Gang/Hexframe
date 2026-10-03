import { Simulation } from "../../combat";
import type { FrameReport, InputFrame } from "../../combat";

export type LabSpeed = 25 | 100;
const SPEED_UNIT = 100;
const NEUTRAL_INPUTS: readonly InputFrame[] = [];

export class Timeline {
  paused = false;
  speed: LabSpeed = 100;
  lastReport: FrameReport | null = null;
  inputProvider: (frame: number) => readonly InputFrame[] = () => NEUTRAL_INPUTS;
  private readonly sim: Simulation;
  private accumulator = 0;

  constructor(sim: Simulation) {
    this.sim = sim;
  }

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
    for (let i = 0; i < frames; i++) reports.push(this.stepOnce());
    return reports;
  }

  reset(): void {
    this.sim.setState(Simulation.initialState(this.sim.config));
    this.lastReport = null;
    this.accumulator = 0;
  }

  private stepOnce(): FrameReport {
    const frame = this.sim.getState().frame;
    const source = this.inputProvider(frame);
    const inputs = Array.from({ length: this.sim.getState().fighters.length }, (_, player) => source[player] ?? 0);
    const report = this.sim.step(inputs);
    this.lastReport = report;
    return report;
  }
}
