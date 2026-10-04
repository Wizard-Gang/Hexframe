import { moveOf } from "../../combat/commands/resolve";
import type { CharacterDef, FighterState } from "../../combat/types";
import { StateId } from "../../combat/types";
import { depthProfileName } from "../../rig/depth";
import type { Rig } from "../../rig/types";

export type FightLabClipName =
  | "crouch"
  | "crouchGuard"
  | "jump"
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
  crouch: "anatomical",
  crouchGuard: "both-front",
  jump: "locomotion",
  labGuard: "both-front",
  labOverhead: "punch",
  labStrike: "punch",
  labWalk: "locomotion",
};

function attackClip(key: string | undefined): FightLabClipName {
  if (key === "overhead" || key === "uppercut") return "labOverhead";
  return "labStrike";
}

function jumpAirFrames(character: CharacterDef): number {
  if (character.gravity <= 0) return 0;
  return Math.ceil((character.jumpVelocityY * 2) / character.gravity) + 2;
}

function jumpFrame(fighter: FighterState, character: CharacterDef): number {
  if (fighter.state === StateId.JumpSquat) return fighter.stateFrame;
  if (fighter.state === StateId.Landing) {
    return character.jumpSquatFrames + jumpAirFrames(character) + fighter.stateFrame;
  }
  return character.jumpSquatFrames + fighter.stateFrame;
}

/**
 * Presentation-only FightLab clip selection. Combat state chooses the image; no sampled
 * pose, FK placement or depth decision feeds back into simulation authority.
 */
export function fightLabPresentation(fighter: FighterState, character: CharacterDef): FightLabPresentation {
  if (fighter.state === StateId.Attack) {
    return { clip: attackClip(moveOf(character, fighter.moveId)?.key), frame: fighter.moveFrame };
  }
  if (fighter.state === StateId.BlockstunCrouch) {
    return { clip: "crouchGuard", frame: fighter.stateFrame };
  }
  if (fighter.state === StateId.BlockstunStand) {
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
  if (fighter.state === StateId.Crouch) {
    return { clip: "crouch", frame: fighter.stateFrame };
  }
  if (
    fighter.state === StateId.JumpSquat
    || fighter.state === StateId.Airborne
    || fighter.state === StateId.Landing
    || fighter.airborne === 1
  ) {
    return { clip: "jump", frame: jumpFrame(fighter, character) };
  }
  if (fighter.state === StateId.WalkForward || fighter.state === StateId.WalkBackward) {
    return { clip: "labWalk", frame: fighter.stateFrame };
  }
  return { clip: "labIdle", frame: fighter.stateFrame };
}

export function depthProfileForClip(rig: Rig, clip: FightLabClipName): string {
  return DEPTH_PROFILE_BY_CLIP[clip] ?? depthProfileName(rig, clip);
}
