import { INPUT_MASK } from "../../combat/types";
import type { ContactEvent, Simulation } from "../../combat";
import { hashState, hashToHex } from "../../rollback/hashing/fnv";
import type { RecordedInputFrame } from "../timeline/timeline";
import { Timeline } from "../timeline/timeline";

export const COMBAT_SCENARIO_SCHEMA = "hexframe.combat-scenario";
export const COMBAT_SCENARIO_VERSION = 1;
const MAX_SCENARIO_FRAMES = 36_000;

export interface ScenarioContact extends ContactEvent {
  frame: number;
}

/** Portable input script plus the deterministic result it is expected to reproduce. */
export interface CombatScenario {
  schema: typeof COMBAT_SCENARIO_SCHEMA;
  version: typeof COMBAT_SCENARIO_VERSION;
  name: string;
  seed: number;
  startX: number[];
  characters: {
    id: string;
    health: number;
    stamina: number;
    moveIds: number[];
  }[];
  inputs: RecordedInputFrame[];
  expected: {
    stateFrame: number;
    hash: string;
    contacts: ScenarioContact[];
  };
}

export interface ScenarioReplayResult {
  matches: boolean;
  expectedHash: string;
  actualHash: string;
  stateFrame: number;
  reports: number;
}

/** Capture the exact input history and terminal state currently selected in the lab. */
export function captureScenario(
  sim: Simulation,
  timeline: Timeline,
  name = "combat_lab_capture",
): CombatScenario {
  const stateFrame = sim.getState().frame;
  const contacts: ScenarioContact[] = [];
  for (const report of timeline.reports(stateFrame)) {
    for (const contact of report.contacts) contacts.push({ frame: report.frame, ...contact });
  }

  return {
    schema: COMBAT_SCENARIO_SCHEMA,
    version: COMBAT_SCENARIO_VERSION,
    name: safeScenarioName(name),
    seed: sim.config.seed,
    startX: [...sim.config.startX],
    characters: sim.characters().map((character) => ({
      id: character.id,
      health: character.health,
      stamina: character.stamina,
      moveIds: character.moves.map((move) => move.id),
    })),
    inputs: timeline.recordedInputs(stateFrame),
    expected: {
      stateFrame,
      hash: hashToHex(hashState(sim.getState())),
      contacts,
    },
  };
}

/** Execute a capture headlessly through the same Timeline used by the visual scrubber. */
export function replayScenario(
  sim: Simulation,
  timeline: Timeline,
  scenario: CombatScenario,
): ScenarioReplayResult {
  const reports = timeline.replay(scenario.inputs);
  const actualHash = hashToHex(hashState(sim.getState()));
  return {
    matches:
      actualHash === scenario.expected.hash &&
      sim.getState().frame === scenario.expected.stateFrame,
    expectedHash: scenario.expected.hash,
    actualHash,
    stateFrame: sim.getState().frame,
    reports: reports.length,
  };
}

/** Parse an imported scenario with strict bounds before it can drive the simulation. */
export function parseScenario(value: unknown): CombatScenario {
  if (!isRecord(value)) throw new TypeError("Scenario must be a JSON object.");
  if (value.schema !== COMBAT_SCENARIO_SCHEMA || value.version !== COMBAT_SCENARIO_VERSION) {
    throw new TypeError("Unsupported Hexframe combat scenario schema.");
  }
  if (typeof value.name !== "string" || typeof value.seed !== "number") {
    throw new TypeError("Scenario name or seed is invalid.");
  }
  if (!Array.isArray(value.startX) || !value.startX.every(Number.isInteger)) {
    throw new TypeError("Scenario start positions are invalid.");
  }
  if (!Array.isArray(value.inputs) || value.inputs.length > MAX_SCENARIO_FRAMES) {
    throw new TypeError("Scenario input history is invalid or too long.");
  }

  const inputs: RecordedInputFrame[] = value.inputs.map((row, index) => {
    if (!isRecord(row) || row.frame !== index || !Array.isArray(row.inputs)) {
      throw new TypeError(`Scenario input row ${index} is not contiguous.`);
    }
    const frameInputs = row.inputs.map((input) => {
      if (!Number.isInteger(input) || (input as number) < 0 || ((input as number) & ~INPUT_MASK) !== 0) {
        throw new TypeError(`Scenario input row ${index} contains an invalid bitmask.`);
      }
      return input as number;
    });
    return { frame: index, inputs: frameInputs };
  });

  if (!isRecord(value.expected) || !Number.isInteger(value.expected.stateFrame) || typeof value.expected.hash !== "string") {
    throw new TypeError("Scenario expected result is invalid.");
  }
  if (value.expected.stateFrame !== inputs.length || !/^[0-9a-f]{8}$/.test(value.expected.hash)) {
    throw new TypeError("Scenario terminal frame or hash is invalid.");
  }
  if (!Array.isArray(value.characters) || !Array.isArray(value.expected.contacts)) {
    throw new TypeError("Scenario metadata or contacts are invalid.");
  }

  // The remaining metadata was produced by `captureScenario`; it is descriptive and
  // never used to allocate memory or execute code. JSON round-tripping gives a detached
  // object, while the checks above protect every field that can drive the simulation.
  return {
    ...(value as unknown as CombatScenario),
    name: safeScenarioName(value.name),
    inputs,
  };
}

export function scenarioJson(scenario: CombatScenario): string {
  return `${JSON.stringify(scenario, null, 2)}\n`;
}

function safeScenarioName(name: string): string {
  const safe = name.trim().replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return (safe || "combat_lab_capture").slice(0, 80);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
