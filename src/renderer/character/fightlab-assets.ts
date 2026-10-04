import fighterRigJson from "../../../characters/fighter/fighter.rig.json";
import labGuardJson from "../../../characters/fighter/clips/labGuard.json";
import labIdleJson from "../../../characters/fighter/clips/labIdle.json";
import labOverheadJson from "../../../characters/fighter/clips/labOverhead.json";
import labStaggerJson from "../../../characters/fighter/clips/labStagger.json";
import labStrikeJson from "../../../characters/fighter/clips/labStrike.json";
import labWalkJson from "../../../characters/fighter/clips/labWalk.json";
import labWaveJson from "../../../characters/fighter/clips/labWave.json";
import armLowerL from "../../../characters/fighter/parts/arm_lower_l.svg?raw";
import armLowerR from "../../../characters/fighter/parts/arm_lower_r.svg?raw";
import armUpperL from "../../../characters/fighter/parts/arm_upper_l.svg?raw";
import armUpperR from "../../../characters/fighter/parts/arm_upper_r.svg?raw";
import head from "../../../characters/fighter/parts/head.svg?raw";
import legLowerL from "../../../characters/fighter/parts/leg_lower_l.svg?raw";
import legLowerR from "../../../characters/fighter/parts/leg_lower_r.svg?raw";
import legUpperL from "../../../characters/fighter/parts/leg_upper_l.svg?raw";
import legUpperR from "../../../characters/fighter/parts/leg_upper_r.svg?raw";
import pelvis from "../../../characters/fighter/parts/pelvis.svg?raw";
import torso from "../../../characters/fighter/parts/torso.svg?raw";
import type { Clip } from "../../rig/clip-types";
import { createRig } from "../../rig/rig";
import type { RigContract } from "../../rig/types";
import type { FightLabClipName } from "./fightlab-presentation";

function clip(value: unknown): Clip {
  return value as Clip;
}

export const FIGHTLAB_RIG = createRig(fighterRigJson as unknown as RigContract);

export const FIGHTLAB_CLIPS: Readonly<Record<FightLabClipName, Clip>> = Object.freeze({
  labGuard: clip(labGuardJson),
  labIdle: clip(labIdleJson),
  labOverhead: clip(labOverheadJson),
  labStagger: clip(labStaggerJson),
  labStrike: clip(labStrikeJson),
  labWalk: clip(labWalkJson),
  labWave: clip(labWaveJson),
});

export const FIGHTLAB_PARTS: Readonly<Record<string, string>> = Object.freeze({
  pelvis,
  "leg-front": legUpperR,
  "shin-front": legLowerR,
  "leg-back": legUpperL,
  "shin-back": legLowerL,
  torso,
  "arm-front": armUpperR,
  "forearm-front": armLowerR,
  "arm-back": armUpperL,
  "forearm-back": armLowerL,
  head,
});

export const FIGHTER_HURTBOX_HEIGHT_PX = 104;
export const FIGHTLAB_STANDING_SCALE = FIGHTER_HURTBOX_HEIGHT_PX / FIGHTLAB_RIG.contract.space.height;

export const FIGHTLAB_FIGHTER_ASSET = {
  rig: FIGHTLAB_RIG,
  parts: FIGHTLAB_PARTS,
  clips: FIGHTLAB_CLIPS,
  presentationScale: FIGHTLAB_STANDING_SCALE,
} as const;
