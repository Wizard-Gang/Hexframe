import type { RawAnimation, RawBonePose } from "./raw-types";

type Pose = Record<string, RawBonePose>;

interface AuthoredAttack {
  duration: number;
  contact: number;
  activeEnd: number;
  anticipation: Pose;
  strike: Pose;
  followThrough: Pose;
  start?: Pose;
  end?: Pose;
}

const READY: Pose = {
  torso: { rotation: 0 }, head: { rotation: 0 }, pelvis: { x: 0, y: 0, rotation: 0 },
  arm_upper_l: { rotation: -14 }, arm_lower_l: { rotation: -34 }, hand_l: { rotation: 0 },
  arm_upper_r: { rotation: -20 }, arm_lower_r: { rotation: -46 }, hand_r: { rotation: 0 },
  leg_upper_l: { rotation: 6 }, leg_lower_l: { rotation: -8 }, foot_l: { rotation: 0 },
  leg_upper_r: { rotation: -8 }, leg_lower_r: { rotation: 6 }, foot_r: { rotation: 0 },
};

const CROUCH_READY: Pose = {
  pelvis: { x: 0, y: -20, rotation: 0 }, torso: { rotation: 12 }, head: { rotation: -8 },
  leg_upper_l: { rotation: 62 }, leg_lower_l: { rotation: -78 }, foot_l: { rotation: 14 },
  leg_upper_r: { rotation: -54 }, leg_lower_r: { rotation: 70 }, foot_r: { rotation: -12 },
  arm_upper_l: { rotation: -30 }, arm_lower_l: { rotation: -50 },
  arm_upper_r: { rotation: -34 }, arm_lower_r: { rotation: -60 },
};

/**
 * Every technique owns its anticipation, contact and follow-through silhouettes. This is
 * intentionally verbose authoring data: move names no longer collapse onto a handful of
 * modulo-selected pose templates, and presentation can evolve without touching MoveDef.
 */
/** The four playable techniques retain their authored presentation silhouettes. */
const AUTHORED_ATTACKS: Record<string, AuthoredAttack> = {
  jab: {
    duration: 22, contact: 6, activeEnd: 8,
    anticipation: { pelvis: { x: -3 }, torso: { rotation: -13 }, head: { rotation: 6 }, arm_upper_r: { rotation: -48 }, arm_lower_r: { rotation: -78 }, hand_r: { rotation: -22 }, arm_upper_l: { rotation: -22 }, arm_lower_l: { rotation: -62 } },
    strike: { pelvis: { x: 7 }, torso: { rotation: 16 }, head: { rotation: -7 }, arm_upper_r: { rotation: 84 }, arm_lower_r: { rotation: -1 }, hand_r: { rotation: 28 }, arm_upper_l: { rotation: -46 }, arm_lower_l: { rotation: -56 }, leg_upper_r: { rotation: -18 }, foot_r: { rotation: 0 } },
    followThrough: { pelvis: { x: 5 }, torso: { rotation: 21 }, arm_upper_r: { rotation: 102 }, arm_lower_r: { rotation: 10 }, hand_r: { rotation: 34 }, arm_upper_l: { rotation: -34 } },
  },
  overhead: {
    duration: 28, contact: 9, activeEnd: 11,
    anticipation: { pelvis: { y: -8, x: -4 }, torso: { rotation: 18 }, head: { rotation: -10 }, leg_upper_r: { rotation: 34 }, leg_lower_r: { rotation: -76 }, foot_r: { rotation: 22 }, leg_upper_l: { rotation: -18 }, arm_upper_l: { rotation: -54 }, arm_upper_r: { rotation: -62 } },
    strike: { pelvis: { y: 6, x: 4 }, torso: { rotation: -26 }, head: { rotation: 15 }, leg_upper_r: { rotation: 102 }, leg_lower_r: { rotation: -4 }, foot_r: { rotation: 12 }, leg_upper_l: { rotation: -32 }, leg_lower_l: { rotation: 22 }, foot_l: { rotation: -8 }, arm_upper_l: { rotation: -116 }, arm_lower_l: { rotation: -12 }, arm_upper_r: { rotation: -78 }, arm_lower_r: { rotation: -24 } },
    followThrough: { pelvis: { y: 1, x: 3 }, torso: { rotation: -12 }, leg_upper_r: { rotation: 78 }, leg_lower_r: { rotation: -24 }, foot_r: { rotation: 18 }, arm_upper_l: { rotation: -92 } },
  },
  sweep: {
    duration: 26, contact: 8, activeEnd: 11, start: CROUCH_READY, end: CROUCH_READY,
    anticipation: { pelvis: { y: -27, x: -4, rotation: -8 }, torso: { rotation: -17 }, head: { rotation: 12 }, leg_upper_r: { rotation: 68 }, leg_lower_r: { rotation: -88 }, leg_upper_l: { rotation: -12 }, leg_lower_l: { rotation: 18 }, arm_upper_l: { rotation: 32 }, arm_upper_r: { rotation: -74 } },
    strike: { pelvis: { y: -29, x: 4, rotation: 20 }, torso: { rotation: 34 }, head: { rotation: -23 }, leg_upper_r: { rotation: 112 }, leg_lower_r: { rotation: -4 }, foot_r: { rotation: 18 }, leg_upper_l: { rotation: 46 }, leg_lower_l: { rotation: -60 }, foot_l: { rotation: 0 }, arm_upper_l: { rotation: -92 }, arm_upper_r: { rotation: 56 } },
    followThrough: { pelvis: { y: -25, x: 5, rotation: 16 }, torso: { rotation: 28 }, leg_upper_r: { rotation: 136 }, leg_lower_r: { rotation: 12 }, arm_upper_l: { rotation: -74 } },
  },
  uppercut: {
    duration: 36, contact: 9, activeEnd: 13,
    anticipation: { pelvis: { y: -24, x: -4 }, torso: { rotation: 22 }, head: { rotation: -14 }, leg_upper_l: { rotation: 68 }, leg_lower_l: { rotation: -84 }, leg_upper_r: { rotation: -62 }, leg_lower_r: { rotation: 78 }, arm_upper_r: { rotation: -74 }, arm_lower_r: { rotation: -24 }, arm_upper_l: { rotation: -48 } },
    strike: { pelvis: { y: 12, x: 7 }, torso: { rotation: -10 }, head: { rotation: 7 }, arm_upper_r: { rotation: -174 }, arm_lower_r: { rotation: -2 }, arm_upper_l: { rotation: -118 }, arm_lower_l: { rotation: -18 }, leg_upper_r: { rotation: 72 }, leg_lower_r: { rotation: -88 }, foot_r: { rotation: 18 }, leg_upper_l: { rotation: -34 }, leg_lower_l: { rotation: 10 } },
    followThrough: { pelvis: { y: 16, x: 9 }, torso: { rotation: -18 }, arm_upper_r: { rotation: -196 }, leg_upper_r: { rotation: 88 }, leg_lower_r: { rotation: -102 }, arm_upper_l: { rotation: -140 } },
  },
};

function buildAnimation(name: string, spec: AuthoredAttack): RawAnimation {
  return {
    name,
    loop: false,
    duration: spec.duration,
    note: "Authored anticipation, contact and follow-through silhouettes; combat timing remains separate.",
    keyframes: [
      { frame: 0, bones: spec.start ?? READY },
      { frame: Math.max(1, spec.contact - 2), bones: spec.anticipation },
      { frame: spec.contact, bones: spec.strike },
      { frame: Math.min(spec.duration, spec.activeEnd + 3), bones: spec.followThrough },
      { frame: spec.duration, bones: spec.end ?? READY },
    ],
  };
}

export const ADDITIONAL_ANIMATIONS: Record<string, RawAnimation> = Object.fromEntries(
  Object.entries(AUTHORED_ATTACKS).map(([name, spec]) => [name, buildAnimation(name, spec)]),
);
