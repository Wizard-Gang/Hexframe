import { moveOf } from "../../combat/commands/resolve";
import type { CharacterDef, FighterState } from "../../combat/types";
import { StateId } from "../../combat/types";
import { depthProfileName } from "../../rig/depth";
import type { Rig } from "../../rig/types";

export type FightLabClipName =
  | "labGuard"
  | "labIdle"
  | "labOverhead"
  | "labStagger"
  | "labStrike"
  | "labWalk"
  | "labWave";

export interface FightLabPresentation {
  readonly clip: FightLabClipName;
  readonly frame: number;
}

const DEPTH_PROFILE_BY_CLIP: Partial<Record<FightLabClipName, string>> = {
  labGuard: "both-front",
  labOverhead: "punch",
  labStrike: "punch",
  labWalk: "locomotion",
};

function attackClip(key: string | undefined): FightLabClipName {
  if (key === "overhead" || key === "uppercut") return "labOverhead";
  return "labStrike";
}

/**
 * Presentation-only FightLab clip selection. Combat state chooses the image; no sampled
 * pose, FK placement or depth decision feeds back into simulation authority.
 */
export function fightLabPresentation(fighter: FighterState, character: CharacterDef): FightLabPresentation {
  if (fighter.state === StateId.Attack) {
    return { clip: attackClip(moveOf(character, fighter.moveId)?.key), frame: fighter.moveFrame };
  }
  if (fighter.state === StateId.BlockstunStand || fighter.state === StateId.BlockstunCrouch) {
    return { clip: "labGuard", frame: fighter.stateFrame };
  }
  if (
    fighter.state === StateId.HitstunStand
    || fighter.state === StateId.HitstunCrouch
    || fighter.state === StateId.HitstunAir
    || fighter.state === StateId.Knockdown
    || fighter.state === StateId.Defeat
  ) {
    return { clip: "labStagger", frame: fighter.stateFrame };
  }
  // HF-183 owns authored crouch/guard/jump clips. Guard and walk are the nearest current poses.
  if (fighter.state === StateId.Crouch) return { clip: "labGuard", frame: fighter.stateFrame };
  if (
    fighter.state === StateId.JumpSquat
    || fighter.state === StateId.Airborne
    || fighter.state === StateId.Landing
    || fighter.airborne === 1
  ) {
    return { clip: "labWalk", frame: fighter.stateFrame };
  }
  if (fighter.state === StateId.WalkForward || fighter.state === StateId.WalkBackward) {
    return { clip: "labWalk", frame: fighter.stateFrame };
  }
  return { clip: "labIdle", frame: fighter.stateFrame };
}

export function depthProfileForClip(rig: Rig, clip: FightLabClipName): string {
  return DEPTH_PROFILE_BY_CLIP[clip] ?? depthProfileName(rig, clip);
}
