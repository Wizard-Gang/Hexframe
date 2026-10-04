import labGuardJson from "../../characters/fighter/clips/labGuard.json";
import labIdleJson from "../../characters/fighter/clips/labIdle.json";
import labOverheadJson from "../../characters/fighter/clips/labOverhead.json";
import labStaggerJson from "../../characters/fighter/clips/labStagger.json";
import labStrikeJson from "../../characters/fighter/clips/labStrike.json";
import labWalkJson from "../../characters/fighter/clips/labWalk.json";
import labWaveJson from "../../characters/fighter/clips/labWave.json";
import fighterRigJson from "../../characters/fighter/fighter.rig.json";
import type { Clip } from "../../src/rig/clip-types.ts";
import { createRig } from "../../src/rig/rig.ts";
import type { RigContract } from "../../src/rig/types.ts";

export const rig = createRig(fighterRigJson as unknown as RigContract);

export const labClips = [
  ["labGuard", labGuardJson],
  ["labIdle", labIdleJson],
  ["labOverhead", labOverheadJson],
  ["labStagger", labStaggerJson],
  ["labStrike", labStrikeJson],
  ["labWalk", labWalkJson],
  ["labWave", labWaveJson],
] as const;

export function asClip(value: unknown): Clip {
  return value as Clip;
}
