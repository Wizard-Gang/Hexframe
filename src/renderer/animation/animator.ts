import type { CharacterDef, FighterState } from "../../combat/types";
import { StateId } from "../../combat/types";
import { SCALE } from "../../combat/constants";
import { moveOf } from "../../combat/commands/resolve";
import type { RawAnimation, RawBonePose } from "../../content/raw-types";

export type Pose = Record<string, RawBonePose>;
type PoseKey = keyof RawBonePose;

export interface AnimationPlayback {
  phaseMode?: "time" | "distance";
  /** World pixels covered by one complete locomotion cycle. */
  strideDistance?: number;
}

const POSE_KEYS: readonly PoseKey[] = ["rotation", "x", "y"];

function animationFrame(anim: RawAnimation, frame: number): number {
  if (anim.duration <= 0) return 0;
  if (anim.loop) return ((frame % anim.duration) + anim.duration) % anim.duration;
  return Math.max(0, Math.min(frame, anim.duration));
}

/** Samples sparse keyframes, interpolating each authored bone property independently. */
export function sampleAnimation(anim: RawAnimation, frame: number): Pose {
  const at = animationFrame(anim, Math.max(0, frame));
  const boneNames = new Set<string>();
  for (const keyframe of anim.keyframes) {
    for (const name of Object.keys(keyframe.bones)) boneNames.add(name);
  }

  const pose: Pose = {};
  for (const name of boneNames) {
    const bone: RawBonePose = {};
    for (const property of POSE_KEYS) {
      let beforeFrame = 0;
      let beforeValue = 0;
      let afterFrame = -1;
      let afterValue = 0;

      for (const keyframe of anim.keyframes) {
        const value = keyframe.bones[name]?.[property];
        if (value === undefined) continue;
        if (keyframe.frame <= at && keyframe.frame >= beforeFrame) {
          beforeFrame = keyframe.frame;
          beforeValue = value;
        } else if (keyframe.frame > at && (afterFrame < 0 || keyframe.frame < afterFrame)) {
          afterFrame = keyframe.frame;
          afterValue = value;
        }
      }

      if (afterFrame < 0 || afterFrame === beforeFrame) {
        bone[property] = beforeValue;
      } else {
        const progress = (at - beforeFrame) / (afterFrame - beforeFrame);
        bone[property] = beforeValue + (afterValue - beforeValue) * progress;
      }
    }
    pose[name] = bone;
  }
  return pose;
}

/** Presentation clip for a combat state. Combat never reads this choice back. */
export function animationForState(f: FighterState, c: CharacterDef): string {
  if (f.state === StateId.Defeat) return "defeat";
  if (f.state === StateId.Attack) return moveOf(c, f.moveId)?.animation ?? "idle";
  if (f.state === StateId.JumpSquat) return "jump_squat";
  if (f.state === StateId.Landing) return "landing";
  if (f.state === StateId.HitstunAir) return "hit_air";
  if (f.airborne === 1 || f.state === StateId.Airborne) {
    if (f.vy > 2 * SCALE) return "jump_rise";
    if (f.vy < -2 * SCALE) return "jump_fall";
    return "jump_apex";
  }
  if (f.state === StateId.BlockstunStand) return "block_stand";
  if (f.state === StateId.BlockstunCrouch) return "block_crouch";
  if (f.state === StateId.HitstunStand) return "hit_stand";
  if (f.state === StateId.HitstunCrouch) return "hit_crouch";
  if (f.state === StateId.Knockdown) return f.stateFrame < 12 ? "knockdown" : "getup";
  if (f.state === StateId.Crouch) return f.stateFrame < 4 ? "crouch_enter" : "crouch_idle";
  if (f.state === StateId.WalkForward) return "walk_forward";
  if (f.state === StateId.WalkBackward) return "walk_backward";
  return "idle";
}

/**
 * Chooses a clip-local presentation frame without adding visual state to the simulation.
 * Walks phase from authoritative position, while air sub-clips phase from authoritative
 * velocity. Both therefore survive chill, save-state scrubbing and rollback exactly.
 */
export function animationFrameForState(
  f: FighterState,
  c: CharacterDef,
  clipName: string,
  clip: RawAnimation,
  playback: AnimationPlayback = {},
): number {
  if (f.state === StateId.Attack) return f.moveFrame;
  if (playback.phaseMode === "distance" && playback.strideDistance && playback.strideDistance > 0) {
    const distance = Math.abs(f.x / SCALE);
    const phase = (distance % playback.strideDistance) / playback.strideDistance;
    return Math.floor(phase * clip.duration);
  }
  if (clipName === "jump_apex") {
    return Math.max(0, Math.floor((2 * SCALE - f.vy) / Math.max(1, c.gravity)));
  }
  if (clipName === "jump_fall") {
    return Math.max(0, Math.floor((-2 * SCALE - f.vy) / Math.max(1, c.gravity)));
  }
  if (clipName === "crouch_idle") return Math.max(0, f.stateFrame - 4);
  if (clipName === "getup") return Math.max(0, f.stateFrame - 12);
  return f.stateFrame;
}
