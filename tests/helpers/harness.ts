import { Simulation } from "../../src/combat/simulation/simulation";
import { px } from "../../src/combat/constants";
import type { FrameReport, InputFrame } from "../../src/combat/types";
import { testFighterSimConfig } from "../../src/content/test-fighter";

/**
 * A scripted input source for a run of frames.
 *
 * Both supported shapes are pure functions of the frame index so replaying a restored
 * state produces exactly the same input stream.
 */
export type InputScript =
  | ((frame: number, player: number) => InputFrame)
  | readonly (readonly InputFrame[])[];

export function createSim(seed?: number): Simulation {
  return new Simulation(testFighterSimConfig(seed));
}

/** Both players' inputs for one frame. Anything the script does not cover is neutral. */
export function inputsFor(script: InputScript | undefined, frame: number): InputFrame[] {
  if (script === undefined) return [0, 0];
  if (typeof script === "function") return [script(frame, 0), script(frame, 1)];
  const row: readonly InputFrame[] | undefined = script[frame];
  if (row === undefined) return [0, 0];
  return [row[0] ?? 0, row[1] ?? 0];
}

export function runFrames(sim: Simulation, count: number, script?: InputScript): FrameReport[] {
  const reports: FrameReport[] = [];
  for (let i = 0; i < count; i++) {
    reports.push(sim.step(inputsFor(script, sim.getState().frame)));
  }
  return reports;
}

export function runSim(
  count: number,
  script?: InputScript,
  seed?: number,
): { sim: Simulation; reports: FrameReport[] } {
  const sim = createSim(seed);
  return { sim, reports: runFrames(sim, count, script) };
}

export function placeFighters(sim: Simulation, p0PixelX: number, p1PixelX: number): void {
  const fighters = sim.getState().fighters;
  fighters[0].x = px(p0PixelX);
  fighters[0].vx = 0;
  fighters[1].x = px(p1PixelX);
  fighters[1].vx = 0;
}
