import type { RawHitLevel, RawMove } from "./raw-types";
import { validateMove } from "./validate";

interface KitMoveBlueprint {
  id: number;
  key: string;
  tags: string[];
  description: string;
  level: RawHitLevel;
  damage: number;
  startup: number;
  active: number;
  recovery: number;
  box: { x: number; y: number; w: number; h: number };
  hitstun: number;
  blockstun: number;
  pushback: number;
  lunge?: number;
  launchVelocityY?: number;
  cancelInto?: readonly number[];
}

const KIT_BLUEPRINTS: readonly KitMoveBlueprint[] = [
  {
    id: 3, key: "jab", tags: ["starter", "strike"],
    description: "Fast jab that starts the fixed combo route.", level: "mid",
    damage: 38, startup: 5, active: 3, recovery: 12,
    box: { x: 34, y: 56, w: 22, h: 24 }, hitstun: 16, blockstun: 10,
    pushback: 3.1, lunge: 1.2, cancelInto: [11],
  },
  {
    id: 5, key: "overhead", tags: ["starter", "kick"],
    description: "Long overhead strike that checks crouching guard.", level: "overhead",
    damage: 44, startup: 16, active: 2, recovery: 12,
    box: { x: 36, y: 60, w: 26, h: 46 }, hitstun: 19, blockstun: 12,
    pushback: 3.8,
  },
  {
    id: 11, key: "sweep", tags: ["link", "low"],
    description: "Low sweep that links Jab into the launcher.", level: "low",
    damage: 36, startup: 8, active: 4, recovery: 14,
    box: { x: 38, y: 0, w: 28, h: 34 }, hitstun: 18, blockstun: 11,
    pushback: 3.6, cancelInto: [18],
  },
  {
    id: 18, key: "uppercut", tags: ["cashout", "launch"],
    description: "Rising uppercut that launches at the end of the fixed route.", level: "mid",
    damage: 55, startup: 9, active: 5, recovery: 22,
    box: { x: 18, y: 76, w: 38, h: 40 }, hitstun: 24, blockstun: 14,
    pushback: 4.5, lunge: 2.2, launchVelocityY: 7.4,
  },
];

function buildMove(blueprint: KitMoveBlueprint): RawMove {
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
      box: blueprint.box,
      startFrame: activeStart,
      endFrame: activeEnd,
      level: blueprint.level,
      damage: blueprint.damage,
      hitstun: blueprint.hitstun,
      blockstun: blueprint.blockstun,
      hitstopAttacker: Math.max(5, Math.trunc(blueprint.damage / 9)),
      hitstopDefender: Math.max(7, Math.trunc(blueprint.damage / 7)),
      pushbackHitAttacker: -Math.max(0.8, Math.abs(blueprint.pushback) * 0.35),
      pushbackHitDefender: blueprint.pushback,
      pushbackBlockAttacker: -Math.max(1, Math.abs(blueprint.pushback) * 0.45),
      pushbackBlockDefender: blueprint.pushback * 0.72,
      launchVelocityY: blueprint.launchVelocityY ?? 0,
    }],
    hurtboxWindows: [],
    invulWindows: [],
    armorWindows: [],
    movement: blueprint.lunge
      ? [{ frame: 0, vx: blueprint.lunge, vy: 0 }, { frame: activeStart, vx: 0, vy: 0 }]
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

export const ADDITIONAL_MOVES: RawMove[] = KIT_BLUEPRINTS.map((blueprint) =>
  validateMove(buildMove(blueprint), `additionalMoves.${blueprint.key}`),
);
