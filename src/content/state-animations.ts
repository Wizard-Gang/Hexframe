import type { RawAnimation } from "./raw-types";

/**
 * Presentation-only clips for locomotion and reactions. They deliberately do not mirror
 * the combat state enum one-for-one: airborne rise/apex/fall and knockdown/getup are
 * selected from deterministic state values by the renderer.
 */
export const STATE_ANIMATIONS: Record<string, RawAnimation> = {
  crouch_enter: {
    name: "crouch_enter",
    loop: false,
    duration: 4,
    note: "Four-frame compression into the low guard.",
    keyframes: [
      { frame: 0, bones: { pelvis: { y: 0 }, torso: { rotation: 0 }, head: { rotation: 0 } } },
      { frame: 2, bones: { pelvis: { y: -12 }, torso: { rotation: 8 }, leg_upper_l: { rotation: 38 }, leg_lower_l: { rotation: -50 }, leg_upper_r: { rotation: -34 }, leg_lower_r: { rotation: 46 } } },
      { frame: 4, bones: { pelvis: { y: -20 }, torso: { rotation: 12 }, head: { rotation: -8 }, leg_upper_l: { rotation: 62 }, leg_lower_l: { rotation: -78 }, leg_upper_r: { rotation: -54 }, leg_lower_r: { rotation: 70 }, arm_upper_l: { rotation: -30 }, arm_lower_l: { rotation: -50 }, arm_upper_r: { rotation: -34 }, arm_lower_r: { rotation: -60 } } },
    ],
  },
  crouch_idle: {
    name: "crouch_idle",
    loop: true,
    duration: 36,
    note: "Low guard hold with a small, readable breath.",
    keyframes: [
      { frame: 0, bones: { pelvis: { y: -20 }, torso: { rotation: 12 }, head: { rotation: -8 }, leg_upper_l: { rotation: 62 }, leg_lower_l: { rotation: -78 }, leg_upper_r: { rotation: -54 }, leg_lower_r: { rotation: 70 }, arm_upper_l: { rotation: -30 }, arm_lower_l: { rotation: -50 }, arm_upper_r: { rotation: -34 }, arm_lower_r: { rotation: -60 } } },
      { frame: 18, bones: { pelvis: { y: -21 }, torso: { rotation: 14 }, head: { rotation: -10 }, arm_upper_l: { rotation: -34 }, arm_upper_r: { rotation: -38 } } },
      { frame: 36, bones: { pelvis: { y: -20 }, torso: { rotation: 12 }, head: { rotation: -8 }, arm_upper_l: { rotation: -30 }, arm_upper_r: { rotation: -34 } } },
    ],
  },
  jump_squat: {
    name: "jump_squat",
    loop: false,
    duration: 4,
    note: "Hard loading pose: elbows tucked and knees visibly compressed.",
    keyframes: [
      { frame: 0, bones: { pelvis: { y: -4 }, torso: { rotation: 4 }, arm_upper_l: { rotation: -26 }, arm_lower_l: { rotation: -46 }, arm_upper_r: { rotation: -30 }, arm_lower_r: { rotation: -52 } } },
      { frame: 3, bones: { pelvis: { y: -27 }, torso: { rotation: 18 }, head: { rotation: -12 }, leg_upper_l: { rotation: 67 }, leg_lower_l: { rotation: -82 }, foot_l: { rotation: 15 }, leg_upper_r: { rotation: -62 }, leg_lower_r: { rotation: 78 }, foot_r: { rotation: -14 }, arm_upper_l: { rotation: -52 }, arm_lower_l: { rotation: -70 }, arm_upper_r: { rotation: -56 }, arm_lower_r: { rotation: -74 } } },
      { frame: 4, bones: { pelvis: { y: -22 }, torso: { rotation: 10 }, leg_upper_l: { rotation: 46 }, leg_lower_l: { rotation: -64 }, leg_upper_r: { rotation: -42 }, leg_lower_r: { rotation: 58 } } },
    ],
  },
  jump_rise: {
    name: "jump_rise",
    loop: false,
    duration: 10,
    note: "Long vertical launch silhouette with a stretched trailing leg.",
    keyframes: [
      { frame: 0, bones: { pelvis: { y: 2 }, torso: { rotation: -8 }, head: { rotation: 6 }, leg_upper_l: { rotation: 18 }, leg_lower_l: { rotation: -12 }, foot_l: { rotation: -5 }, leg_upper_r: { rotation: -34 }, leg_lower_r: { rotation: 12 }, foot_r: { rotation: -8 }, arm_upper_l: { rotation: -112 }, arm_lower_l: { rotation: -10 }, arm_upper_r: { rotation: -118 }, arm_lower_r: { rotation: -4 } } },
      { frame: 5, bones: { torso: { rotation: -3 }, leg_upper_l: { rotation: 34 }, leg_lower_l: { rotation: -38 }, leg_upper_r: { rotation: -24 }, leg_lower_r: { rotation: 6 }, arm_upper_l: { rotation: -132 }, arm_upper_r: { rotation: -138 } } },
      { frame: 10, bones: { torso: { rotation: 5 }, leg_upper_l: { rotation: 48 }, leg_lower_l: { rotation: -58 }, leg_upper_r: { rotation: 20 }, leg_lower_r: { rotation: -32 }, arm_upper_l: { rotation: -82 }, arm_lower_l: { rotation: -44 }, arm_upper_r: { rotation: -88 }, arm_lower_r: { rotation: -40 } } },
    ],
  },
  jump_apex: {
    name: "jump_apex",
    loop: false,
    duration: 6,
    note: "Compact airborne tuck centered around zero vertical velocity.",
    keyframes: [
      { frame: 0, bones: { pelvis: { y: 2 }, torso: { rotation: 10 }, head: { rotation: -5 }, leg_upper_l: { rotation: 62 }, leg_lower_l: { rotation: -82 }, foot_l: { rotation: 18 }, leg_upper_r: { rotation: 52 }, leg_lower_r: { rotation: -76 }, foot_r: { rotation: 14 }, arm_upper_l: { rotation: -42 }, arm_lower_l: { rotation: -68 }, arm_upper_r: { rotation: -48 }, arm_lower_r: { rotation: -72 } } },
      { frame: 3, bones: { pelvis: { y: 4 }, torso: { rotation: 13 }, leg_upper_l: { rotation: 68 }, leg_lower_l: { rotation: -88 }, leg_upper_r: { rotation: 58 }, leg_lower_r: { rotation: -84 } } },
      { frame: 6, bones: { pelvis: { y: 1 }, torso: { rotation: 7 }, leg_upper_l: { rotation: 52 }, leg_lower_l: { rotation: -70 }, leg_upper_r: { rotation: 43 }, leg_lower_r: { rotation: -66 } } },
    ],
  },
  jump_fall: {
    name: "jump_fall",
    loop: false,
    duration: 10,
    note: "Feet drop below the pelvis while the arms spread to prepare for landing.",
    keyframes: [
      { frame: 0, bones: { torso: { rotation: 4 }, leg_upper_l: { rotation: 28 }, leg_lower_l: { rotation: -38 }, leg_upper_r: { rotation: 18 }, leg_lower_r: { rotation: -30 }, arm_upper_l: { rotation: -54 }, arm_lower_l: { rotation: -38 }, arm_upper_r: { rotation: -60 }, arm_lower_r: { rotation: -34 } } },
      { frame: 5, bones: { torso: { rotation: -2 }, head: { rotation: 4 }, leg_upper_l: { rotation: -10 }, leg_lower_l: { rotation: 10 }, foot_l: { rotation: -8 }, leg_upper_r: { rotation: 8 }, leg_lower_r: { rotation: -4 }, foot_r: { rotation: -6 }, arm_upper_l: { rotation: -18 }, arm_lower_l: { rotation: -22 }, arm_upper_r: { rotation: -24 }, arm_lower_r: { rotation: -18 } } },
      { frame: 10, bones: { pelvis: { y: -2 }, torso: { rotation: -7 }, leg_upper_l: { rotation: -22 }, leg_lower_l: { rotation: 16 }, foot_l: { rotation: -12 }, leg_upper_r: { rotation: -12 }, leg_lower_r: { rotation: 10 }, foot_r: { rotation: -10 }, arm_upper_l: { rotation: 12 }, arm_lower_l: { rotation: -10 }, arm_upper_r: { rotation: 8 }, arm_lower_r: { rotation: -8 } } },
    ],
  },
  landing: {
    name: "landing",
    loop: false,
    duration: 3,
    note: "Three-frame impact compression that snaps upright on recovery.",
    keyframes: [
      { frame: 0, bones: { pelvis: { y: -25 }, torso: { rotation: 17 }, head: { rotation: -12 }, leg_upper_l: { rotation: 64 }, leg_lower_l: { rotation: -80 }, foot_l: { rotation: 14 }, leg_upper_r: { rotation: -58 }, leg_lower_r: { rotation: 74 }, foot_r: { rotation: -12 }, arm_upper_l: { rotation: -8 }, arm_upper_r: { rotation: -14 } } },
      { frame: 2, bones: { pelvis: { y: -12 }, torso: { rotation: 8 }, head: { rotation: -5 }, leg_upper_l: { rotation: 34 }, leg_lower_l: { rotation: -44 }, leg_upper_r: { rotation: -30 }, leg_lower_r: { rotation: 40 }, arm_upper_l: { rotation: -16 }, arm_upper_r: { rotation: -22 } } },
      { frame: 3, bones: { pelvis: { y: 0 }, torso: { rotation: 0 }, head: { rotation: 0 }, leg_upper_l: { rotation: 6 }, leg_lower_l: { rotation: -8 }, leg_upper_r: { rotation: -8 }, leg_lower_r: { rotation: 6 }, foot_l: { rotation: 0 }, foot_r: { rotation: 0 }, arm_upper_l: { rotation: -14 }, arm_lower_l: { rotation: -34 }, arm_upper_r: { rotation: -20 }, arm_lower_r: { rotation: -46 } } },
    ],
  },
  block_stand: {
    name: "block_stand",
    loop: false,
    duration: 8,
    note: "High guard absorbs impact through forearms and a rearward torso brace.",
    keyframes: [
      { frame: 0, bones: { pelvis: { x: -3 }, torso: { rotation: -12 }, head: { rotation: 8 }, arm_upper_l: { rotation: 32 }, arm_lower_l: { rotation: 82 }, hand_l: { rotation: 18 }, arm_upper_r: { rotation: 46 }, arm_lower_r: { rotation: 78 }, hand_r: { rotation: 14 }, leg_upper_l: { rotation: -12 }, leg_upper_r: { rotation: 16 } } },
      { frame: 3, bones: { pelvis: { x: -6, y: -2 }, torso: { rotation: -18 }, head: { rotation: 13 }, arm_upper_l: { rotation: 42 }, arm_lower_l: { rotation: 100 }, arm_upper_r: { rotation: 54 }, arm_lower_r: { rotation: 96 } } },
      { frame: 8, bones: { pelvis: { x: -2 }, torso: { rotation: -10 }, head: { rotation: 6 }, arm_upper_l: { rotation: 30 }, arm_lower_l: { rotation: 80 }, arm_upper_r: { rotation: 44 }, arm_lower_r: { rotation: 76 } } },
    ],
  },
  block_crouch: {
    name: "block_crouch",
    loop: false,
    duration: 8,
    note: "Low guard seals the torso and shin behind both forearms.",
    keyframes: [
      { frame: 0, bones: { pelvis: { y: -22, x: -3 }, torso: { rotation: 4 }, head: { rotation: -1 }, leg_upper_l: { rotation: 68 }, leg_lower_l: { rotation: -82 }, leg_upper_r: { rotation: -58 }, leg_lower_r: { rotation: 74 }, arm_upper_l: { rotation: 38 }, arm_lower_l: { rotation: 88 }, arm_upper_r: { rotation: 50 }, arm_lower_r: { rotation: 84 } } },
      { frame: 3, bones: { pelvis: { y: -25, x: -6 }, torso: { rotation: -2 }, head: { rotation: 4 }, arm_upper_l: { rotation: 48 }, arm_lower_l: { rotation: 104 }, arm_upper_r: { rotation: 60 }, arm_lower_r: { rotation: 100 } } },
      { frame: 8, bones: { pelvis: { y: -21, x: -2 }, torso: { rotation: 5 }, arm_upper_l: { rotation: 36 }, arm_lower_l: { rotation: 86 }, arm_upper_r: { rotation: 48 }, arm_lower_r: { rotation: 82 } } },
    ],
  },
  hit_stand: {
    name: "hit_stand",
    loop: false,
    duration: 12,
    note: "Standing recoil opens the chest and throws the head away from contact.",
    keyframes: [
      { frame: 0, bones: { pelvis: { x: -4 }, torso: { rotation: -24 }, head: { rotation: 20 }, arm_upper_l: { rotation: 26 }, arm_lower_l: { rotation: -12 }, arm_upper_r: { rotation: 42 }, arm_lower_r: { rotation: 8 }, leg_upper_l: { rotation: -18 }, leg_upper_r: { rotation: 24 } } },
      { frame: 4, bones: { pelvis: { x: -8, y: -4 }, torso: { rotation: -34 }, head: { rotation: 29 }, arm_upper_l: { rotation: 44 }, arm_lower_l: { rotation: 6 }, arm_upper_r: { rotation: 58 }, arm_lower_r: { rotation: 18 }, leg_upper_l: { rotation: -28 }, leg_lower_l: { rotation: 20 }, leg_upper_r: { rotation: 34 }, leg_lower_r: { rotation: -40 } } },
      { frame: 12, bones: { pelvis: { x: -2, y: 0 }, torso: { rotation: -13 }, head: { rotation: 9 }, arm_upper_l: { rotation: 10 }, arm_lower_l: { rotation: -24 }, arm_upper_r: { rotation: 16 }, arm_lower_r: { rotation: -30 } } },
    ],
  },
  hit_crouch: {
    name: "hit_crouch",
    loop: false,
    duration: 12,
    note: "Low recoil collapses sideways without losing the crouching silhouette.",
    keyframes: [
      { frame: 0, bones: { pelvis: { y: -23, x: -4 }, torso: { rotation: -18 }, head: { rotation: 17 }, leg_upper_l: { rotation: 70 }, leg_lower_l: { rotation: -84 }, leg_upper_r: { rotation: -60 }, leg_lower_r: { rotation: 76 }, arm_upper_l: { rotation: 20 }, arm_lower_l: { rotation: -18 }, arm_upper_r: { rotation: 34 }, arm_lower_r: { rotation: 4 } } },
      { frame: 4, bones: { pelvis: { y: -28, x: -8 }, torso: { rotation: -30 }, head: { rotation: 27 }, arm_upper_l: { rotation: 38 }, arm_lower_l: { rotation: 2 }, arm_upper_r: { rotation: 52 }, arm_lower_r: { rotation: 16 } } },
      { frame: 12, bones: { pelvis: { y: -21, x: -2 }, torso: { rotation: -8 }, head: { rotation: 5 }, arm_upper_l: { rotation: -14 }, arm_lower_l: { rotation: -42 }, arm_upper_r: { rotation: -18 }, arm_lower_r: { rotation: -50 } } },
    ],
  },
  hit_air: {
    name: "hit_air",
    loop: false,
    duration: 12,
    note: "Air hit folds the fighter around the contact before limbs trail outward.",
    keyframes: [
      { frame: 0, bones: { pelvis: { x: -4 }, torso: { rotation: -28 }, head: { rotation: 24 }, leg_upper_l: { rotation: 54 }, leg_lower_l: { rotation: -70 }, leg_upper_r: { rotation: 42 }, leg_lower_r: { rotation: -62 }, arm_upper_l: { rotation: 38 }, arm_lower_l: { rotation: 12 }, arm_upper_r: { rotation: 50 }, arm_lower_r: { rotation: 20 } } },
      { frame: 5, bones: { pelvis: { x: -8 }, torso: { rotation: -40 }, head: { rotation: 34 }, leg_upper_l: { rotation: 20 }, leg_lower_l: { rotation: -18 }, leg_upper_r: { rotation: -28 }, leg_lower_r: { rotation: 12 }, arm_upper_l: { rotation: 68 }, arm_lower_l: { rotation: 24 }, arm_upper_r: { rotation: 82 }, arm_lower_r: { rotation: 30 } } },
      { frame: 12, bones: { pelvis: { x: -3 }, torso: { rotation: -17 }, head: { rotation: 13 }, leg_upper_l: { rotation: 16 }, leg_lower_l: { rotation: -24 }, leg_upper_r: { rotation: 8 }, leg_lower_r: { rotation: -18 }, arm_upper_l: { rotation: 24 }, arm_lower_l: { rotation: -10 }, arm_upper_r: { rotation: 32 }, arm_lower_r: { rotation: -6 } } },
    ],
  },
  knockdown: {
    name: "knockdown",
    loop: false,
    duration: 12,
    note: "The body rotates into a broad horizontal ground silhouette.",
    keyframes: [
      { frame: 0, bones: { pelvis: { y: 0 }, torso: { rotation: -30 }, head: { rotation: 24 }, arm_upper_l: { rotation: 48 }, arm_upper_r: { rotation: 60 } } },
      { frame: 6, bones: { pelvis: { y: -35, x: -12, rotation: -58 }, torso: { rotation: -24 }, head: { rotation: 18 }, leg_upper_l: { rotation: 42 }, leg_lower_l: { rotation: -28 }, leg_upper_r: { rotation: -34 }, leg_lower_r: { rotation: 20 }, arm_upper_l: { rotation: 72 }, arm_upper_r: { rotation: -44 } } },
      { frame: 12, bones: { pelvis: { y: -43, x: -18, rotation: -86 }, torso: { rotation: -4 }, head: { rotation: 8 }, leg_upper_l: { rotation: 18 }, leg_lower_l: { rotation: -10 }, leg_upper_r: { rotation: -12 }, leg_lower_r: { rotation: 8 }, arm_upper_l: { rotation: 22 }, arm_upper_r: { rotation: -18 } } },
    ],
  },
  getup: {
    name: "getup",
    loop: false,
    duration: 10,
    note: "A guarded roll to one knee before the fighter regains stance.",
    keyframes: [
      { frame: 0, bones: { pelvis: { y: -43, x: -18, rotation: -86 }, torso: { rotation: -4 }, head: { rotation: 8 }, leg_upper_l: { rotation: 18 }, leg_upper_r: { rotation: -12 }, arm_upper_l: { rotation: 22 }, arm_upper_r: { rotation: -18 } } },
      { frame: 5, bones: { pelvis: { y: -23, x: -7, rotation: -34 }, torso: { rotation: 19 }, head: { rotation: -12 }, leg_upper_l: { rotation: 64 }, leg_lower_l: { rotation: -78 }, leg_upper_r: { rotation: -52 }, leg_lower_r: { rotation: 68 }, arm_upper_l: { rotation: -22 }, arm_lower_l: { rotation: -66 }, arm_upper_r: { rotation: -28 }, arm_lower_r: { rotation: -72 } } },
      { frame: 10, bones: { pelvis: { y: 0, x: 0, rotation: 0 }, torso: { rotation: 0 }, head: { rotation: 0 }, leg_upper_l: { rotation: 6 }, leg_lower_l: { rotation: -8 }, leg_upper_r: { rotation: -8 }, leg_lower_r: { rotation: 6 }, arm_upper_l: { rotation: -14 }, arm_lower_l: { rotation: -34 }, arm_upper_r: { rotation: -20 }, arm_lower_r: { rotation: -46 } } },
    ],
  },
  defeat: {
    name: "defeat",
    loop: false,
    duration: 30,
    note: "Final presentation-only fall held after vitality reaches zero.",
    keyframes: [
      { frame: 0, bones: { torso: { rotation: -22 }, head: { rotation: 18 }, arm_upper_l: { rotation: 42 }, arm_upper_r: { rotation: 55 } } },
      { frame: 15, bones: { pelvis: { y: -34, x: -12, rotation: -54 }, torso: { rotation: -28 }, head: { rotation: 24 }, leg_upper_l: { rotation: 38 }, leg_upper_r: { rotation: -30 } } },
      { frame: 30, bones: { pelvis: { y: -44, x: -18, rotation: -88 }, torso: { rotation: -6 }, head: { rotation: 10 }, arm_upper_l: { rotation: 24 }, arm_upper_r: { rotation: -18 } } },
    ],
  },
};
