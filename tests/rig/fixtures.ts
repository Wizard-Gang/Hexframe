import crouchJson from "../../characters/fighter/clips/crouch.json";
import crouchGuardJson from "../../characters/fighter/clips/crouchGuard.json";
import jumpJson from "../../characters/fighter/clips/jump.json";
import launchedJson from "../../characters/fighter/clips/launched.json";
import labGuardJson from "../../characters/fighter/clips/labGuard.json";
import labIdleJson from "../../characters/fighter/clips/labIdle.json";
import labOverheadJson from "../../characters/fighter/clips/labOverhead.json";
import labStaggerJson from "../../characters/fighter/clips/labStagger.json";
import labStrikeJson from "../../characters/fighter/clips/labStrike.json";
import labWalkJson from "../../characters/fighter/clips/labWalk.json";
import labWaveJson from "../../characters/fighter/clips/labWave.json";
import sweepJson from "../../characters/fighter/clips/sweep.json";
import uppercutJson from "../../characters/fighter/clips/uppercut.json";
import fighterRigJson from "../../characters/fighter/fighter.rig.json";
import type { Clip } from "../../src/rig/clip-types";
import { createRig } from "../../src/rig/rig";
import type { RigContract } from "../../src/rig/types";

export const rig = createRig(fighterRigJson as unknown as RigContract);

export const labClips = [
  ["crouch", crouchJson],
  ["crouchGuard", crouchGuardJson],
  ["jump", jumpJson],
  ["launched", launchedJson],
  ["labGuard", labGuardJson],
  ["labIdle", labIdleJson],
  ["labOverhead", labOverheadJson],
  ["labStagger", labStaggerJson],
  ["labStrike", labStrikeJson],
  ["labWalk", labWalkJson],
  ["labWave", labWaveJson],
  ["sweep", sweepJson],
  ["uppercut", uppercutJson],
] as const;

export function asClip(value: unknown): Clip {
  return value as Clip;
}
