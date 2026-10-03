import type { RawAnimation, RawBonePose } from "./raw-types";

export type PlayerArmPose = Readonly<Record<"arm_upper_l" | "arm_lower_l" | "arm_upper_r" | "arm_lower_r", RawBonePose>>;

/**
 * Canonical readable guards. Positive authored rotations swing the hanging SVG limbs
 * toward fighter-forward because the renderer converts world-space CCW into SVG space.
 * Keep these intentionally modest: the earlier presentation pass folded the arms too far
 * across the torso and created visible pops into attack anticipation.
 */
export const PLAYER_STANDING_GUARD: PlayerArmPose = {
  arm_upper_l: { rotation: 12 },
  arm_lower_l: { rotation: 28 },
  arm_upper_r: { rotation: 18 },
  arm_lower_r: { rotation: 34 },
};

export const PLAYER_CROUCH_GUARD: PlayerArmPose = {
  arm_upper_l: { rotation: 18 },
  arm_lower_l: { rotation: 36 },
  arm_upper_r: { rotation: 24 },
  arm_lower_r: { rotation: 42 },
};

export const PLAYER_AIR_GUARD: PlayerArmPose = {
  arm_upper_l: { rotation: 8 },
  arm_lower_l: { rotation: 20 },
  arm_upper_r: { rotation: 14 },
  arm_lower_r: { rotation: 26 },
};

/** Give every authored move a readable transition from and back to its neutral stance. */
export function normalizeMovePresentation(animation: RawAnimation): RawAnimation {
  const guard = animation.name === "crouching_light" ? PLAYER_CROUCH_GUARD : PLAYER_STANDING_GUARD;
  return withBoundaryGuard(animation, guard);
}

/** Idle keeps the hands forward while torso/pelvis breathing remains authored. */
export function normalizeIdlePresentation(animation: RawAnimation): RawAnimation {
  return withGuardOnEveryFrame(animation, PLAYER_STANDING_GUARD);
}

/** Walk cycles retain authored foot phases while the arms counter-swing inside guard. */
export function normalizeWalkPresentation(animation: RawAnimation, backward = false): RawAnimation {
  const phases = [0, 3, 6, 3, 0, -3, -6, -3, 0];
  return clone(animation, (bones, index) => {
    const phase = phases[index % phases.length] * (backward ? -1 : 1);
    return {
      ...bones,
      arm_upper_l: { ...bones.arm_upper_l, rotation: 12 + phase },
      arm_lower_l: { ...bones.arm_lower_l, rotation: 28 },
      arm_upper_r: { ...bones.arm_upper_r, rotation: 18 - phase },
      arm_lower_r: { ...bones.arm_lower_r, rotation: 34 },
    };
  });
}

/** Only neutral state clips are normalized; blocks and hits keep authored poses. */
export function normalizeStatePresentation(name: string, animation: RawAnimation): RawAnimation {
  if (name === "crouch_idle") return withGuardOnEveryFrame(animation, PLAYER_CROUCH_GUARD);
  if (name === "jump_rise" || name === "jump_apex" || name === "jump_fall") return withGuardOnEveryFrame(animation, PLAYER_AIR_GUARD);
  return animation;
}

function withBoundaryGuard(animation: RawAnimation, guard: PlayerArmPose): RawAnimation {
  const last = animation.keyframes.length - 1;
  return clone(animation, (bones, index) => index === 0 || index === last ? mergeGuard(bones, guard) : bones);
}

function withGuardOnEveryFrame(animation: RawAnimation, guard: PlayerArmPose): RawAnimation {
  return clone(animation, (bones) => mergeGuard(bones, guard));
}

function mergeGuard(bones: Record<string, RawBonePose>, guard: PlayerArmPose): Record<string, RawBonePose> {
  return {
    ...bones,
    arm_upper_l: { ...bones.arm_upper_l, ...guard.arm_upper_l },
    arm_lower_l: { ...bones.arm_lower_l, ...guard.arm_lower_l },
    arm_upper_r: { ...bones.arm_upper_r, ...guard.arm_upper_r },
    arm_lower_r: { ...bones.arm_lower_r, ...guard.arm_lower_r },
  };
}

function clone(
  animation: RawAnimation,
  transform: (bones: Record<string, RawBonePose>, index: number) => Record<string, RawBonePose>,
): RawAnimation {
  return {
    ...animation,
    keyframes: animation.keyframes.map((keyframe, index) => ({
      ...keyframe,
      bones: transform({ ...keyframe.bones }, index),
    })),
  };
}
