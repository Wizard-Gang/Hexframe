/**
 * Typed Training fighter authority.
 *
 * Combat values are authored here in world pixels and converted once to integer simulation
 * units. Presentation clips and FK may verify these values, but never become combat authority.
 */
import { px } from "../combat/constants";
import type { Box, CharacterDef, HitLevelValue, MoveDef, SimConfig } from "../combat/types";
import { actionBit, HitLevel } from "../combat/types";

interface PixelBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

function simBox(box: PixelBox): Box {
  return { x: px(box.x), y: px(box.y), w: px(box.w), h: px(box.h) };
}

interface KitMoveBlueprint {
  id: number;
  key: string;
  tags: string[];
  description: string;
  level: HitLevelValue;
  damage: number;
  startup: number;
  active: number;
  recovery: number;
  box: PixelBox;
  hitstun: number;
  blockstun: number;
  pushback: number;
  lunge?: number;
  launchVelocityY?: number;
  cancelInto?: readonly number[];
}

export const MoveId = {
  Jab: 3,
  Sweep: 11,
  Overhead: 5,
  Uppercut: 18,
} as const;

export const KIT_MOVE_IDS = [
  MoveId.Jab,
  MoveId.Sweep,
  MoveId.Overhead,
  MoveId.Uppercut,
] as const;

const KIT_BLUEPRINTS: readonly KitMoveBlueprint[] = [
  {
    id: MoveId.Jab,
    key: "jab",
    tags: ["starter", "strike"],
    description: "Fast jab that starts the fixed combo route.",
    level: HitLevel.Mid,
    damage: 38,
    startup: 5,
    active: 3,
    recovery: 12,
    box: { x: 34, y: 56, w: 22, h: 24 },
    hitstun: 16,
    blockstun: 10,
    pushback: 3.1,
    lunge: 1.2,
    cancelInto: [MoveId.Sweep],
  },
  {
    id: MoveId.Sweep,
    key: "sweep",
    tags: ["link", "low"],
    description: "Low sweep that links Jab into the launcher.",
    level: HitLevel.Low,
    damage: 36,
    startup: 8,
    active: 4,
    recovery: 14,
    box: { x: 38, y: 0, w: 28, h: 34 },
    hitstun: 18,
    blockstun: 11,
    pushback: 3.6,
    cancelInto: [MoveId.Uppercut],
  },
  {
    id: MoveId.Overhead,
    key: "overhead",
    tags: ["starter", "kick"],
    description: "Long overhead strike that checks crouching guard.",
    level: HitLevel.Overhead,
    damage: 44,
    startup: 16,
    active: 2,
    recovery: 12,
    box: { x: 36, y: 60, w: 26, h: 46 },
    hitstun: 19,
    blockstun: 12,
    pushback: 3.8,
  },
  {
    id: MoveId.Uppercut,
    key: "uppercut",
    tags: ["cashout", "launch"],
    description: "Rising uppercut that launches at the end of the fixed route.",
    level: HitLevel.Mid,
    damage: 55,
    startup: 9,
    active: 5,
    recovery: 22,
    box: { x: 26, y: 76, w: 39, h: 40 },
    hitstun: 24,
    blockstun: 14,
    pushback: 4.5,
    lunge: 2.2,
    launchVelocityY: 7.4,
  },
];

function buildMove(blueprint: KitMoveBlueprint): MoveDef {
  const duration = blueprint.startup + blueprint.active + blueprint.recovery;
  const activeStart = blueprint.startup;
  const activeEnd = activeStart + blueprint.active - 1;
  return {
    id: blueprint.id,
    key: blueprint.key,
    tags: blueprint.tags.slice(),
    description: blueprint.description,
    duration,
    startup: blueprint.startup,
    active: blueprint.active,
    recovery: blueprint.recovery,
    requiresCrouch: false,
    airOk: false,
    hitboxes: [{
      id: 1,
      box: simBox(blueprint.box),
      startFrame: activeStart,
      endFrame: activeEnd,
      level: blueprint.level,
      damage: blueprint.damage,
      hitstun: blueprint.hitstun,
      blockstun: blueprint.blockstun,
      hitstopAttacker: Math.max(5, Math.trunc(blueprint.damage / 9)),
      hitstopDefender: Math.max(7, Math.trunc(blueprint.damage / 7)),
      pushbackHitAttacker: px(-Math.max(0.8, Math.abs(blueprint.pushback) * 0.35)),
      pushbackHitDefender: px(blueprint.pushback),
      pushbackBlockAttacker: px(-Math.max(1, Math.abs(blueprint.pushback) * 0.45)),
      pushbackBlockDefender: px(blueprint.pushback * 0.72),
      launchVelocityY: px(blueprint.launchVelocityY ?? 0),
    }],
    hurtboxWindows: [],
    invulWindows: [],
    armorWindows: [],
    movement: blueprint.lunge
      ? [{ frame: 0, vx: px(blueprint.lunge), vy: 0 }, { frame: activeStart, vx: 0, vy: 0 }]
      : [],
    cancelWindows: blueprint.cancelInto?.length
      ? [{
          startFrame: activeEnd,
          endFrame: Math.max(activeEnd, duration - 3),
          into: blueprint.cancelInto.slice(),
          onHitOnly: true,
        }]
      : [],
  };
}

const KIT_MOVES = KIT_BLUEPRINTS.map(buildMove);

const KIT_COMMANDS = KIT_MOVE_IDS.map((moveId, slot) => ({
  moveId,
  buttons: actionBit(slot),
  requiresCrouch: false,
  requiresAir: false,
  priority: KIT_MOVE_IDS.length - slot,
}));

export const TEST_FIGHTER: CharacterDef = {
  id: "test_fighter",
  name: "Test Fighter",
  health: 1000,
  walkForwardSpeed: px(2),
  walkBackwardSpeed: px(1.5),
  jumpVelocityY: px(9),
  jumpVelocityXForward: px(3),
  jumpVelocityXBackward: px(-3),
  jumpSquatFrames: 4,
  landingFrames: 3,
  gravity: px(0.6),
  groundFriction: px(0.4),
  pushboxStand: simBox({ x: -18, y: 0, w: 36, h: 96 }),
  pushboxCrouch: simBox({ x: -18, y: 0, w: 36, h: 62 }),
  pushboxAir: simBox({ x: -16, y: 0, w: 32, h: 84 }),
  hurtboxesStand: [
    simBox({ x: -16, y: 0, w: 32, h: 44 }),
    simBox({ x: -18, y: 44, w: 36, h: 38 }),
    simBox({ x: -14, y: 82, w: 28, h: 22 }),
  ],
  hurtboxesCrouch: [
    simBox({ x: -18, y: 0, w: 36, h: 34 }),
    simBox({ x: -18, y: 34, w: 36, h: 22 }),
    simBox({ x: -14, y: 56, w: 28, h: 20 }),
  ],
  hurtboxesAir: [
    simBox({ x: -16, y: 0, w: 32, h: 40 }),
    simBox({ x: -16, y: 40, w: 32, h: 34 }),
    simBox({ x: -13, y: 74, w: 26, h: 20 }),
  ],
  moves: KIT_MOVES,
  commands: KIT_COMMANDS,
};

export function createTestFighter(): CharacterDef {
  return {
    ...TEST_FIGHTER,
    moves: TEST_FIGHTER.moves,
    commands: TEST_FIGHTER.commands.map((command) => ({ ...command })),
  };
}

export const TRAINING_START_X = [px(-40), px(40)] as const;

export function testFighterSimConfig(): SimConfig {
  return {
    characters: [TEST_FIGHTER, TEST_FIGHTER],
    startX: TRAINING_START_X,
  };
}
