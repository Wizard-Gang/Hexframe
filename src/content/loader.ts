/**
 * The crossing point between authored content and the simulation.
 *
 * On one side: world pixels, frames and words like `"mid"`. On the other: sim units and
 * bitmasks. This is the only module that knows both, which is what lets a designer edit a
 * hitbox in pixels and the engine compare it in integers without either of them
 * accommodating the other.
 *
 * It also refuses content that would produce a move nobody could reason about. A hitbox
 * that is live on a frame the move never reaches is not a subtle balance problem, it is a
 * mistake, and finding it at load time is enormously cheaper than finding it as a hitbox
 * that mysteriously never connects.
 */

import type {
  Box,
  CharacterDef,
  CommandDef,
  HitLevelValue,
  HitboxSpec,
  InvulKindValue,
  MoveDef,
} from "../combat/types";
import { actionBit, HitLevel, InputBit, InvulKind } from "../combat/types";
import { px } from "../combat/constants";
import type {
  RawBox,
  RawButton,
  RawCharacter,
  RawHitLevel,
  RawInvulKind,
  RawMove,
} from "./raw-types";
import { ContentError } from "./validate";

/** Authored pixels to sim units. The only place `px()` is applied to content. */
export function scaleBox(b: RawBox): Box {
  return { x: px(b.x), y: px(b.y), w: px(b.w), h: px(b.h) };
}

const LEVELS: Record<RawHitLevel, HitLevelValue> = {
  overhead: HitLevel.Overhead,
  mid: HitLevel.Mid,
  low: HitLevel.Low,
};

const INVUL_KINDS: Record<RawInvulKind, InvulKindValue> = {
  full: InvulKind.Full,
  strike: InvulKind.Strike,
  throw: InvulKind.Throw,
};

const BUTTON_BITS: Record<RawButton, number> = {
  light: InputBit.Light,
  medium: InputBit.Medium,
  heavy: InputBit.Heavy,
  throw: InputBit.Throw,
  action1: actionBit(0),
  action2: actionBit(1),
  action3: actionBit(2),
  action4: actionBit(3),
};

/**
 * The highest hitbox id the once-per-move gate can hold.
 *
 * `FighterState.hitFlags` is one 32-bit mask with one bit per hitbox, and bit 31 is the
 * sign bit. A move needing more than thirty-one separate boxes has outgrown the gate, and
 * being told so is far better than two boxes silently sharing a flag.
 */
const MAX_HITBOX_ID = 30;

function loadHitbox(raw: RawMove["hitboxes"][number], move: RawMove, path: string): HitboxSpec {
  if (raw.id < 0 || raw.id > MAX_HITBOX_ID) {
    throw new ContentError(`${path}.id`, `must be between 0 and ${MAX_HITBOX_ID}`);
  }
  if (raw.endFrame < raw.startFrame) {
    throw new ContentError(`${path}.endFrame`, "must be >= startFrame");
  }
  if (raw.startFrame < 0) {
    throw new ContentError(`${path}.startFrame`, "must be >= 0");
  }
  if (raw.endFrame >= move.duration) {
    throw new ContentError(
      `${path}.endFrame`,
      `must be < the move's duration of ${move.duration}; a hitbox cannot be active on a frame the move never reaches`,
    );
  }
  return {
    id: raw.id,
    box: scaleBox(raw.box),
    startFrame: raw.startFrame,
    endFrame: raw.endFrame,
    level: LEVELS[raw.level],
    damage: raw.damage,
    hitstun: raw.hitstun,
    blockstun: raw.blockstun,
    hitstopAttacker: raw.hitstopAttacker,
    hitstopDefender: raw.hitstopDefender,
    pushbackHitAttacker: px(raw.pushbackHitAttacker),
    pushbackHitDefender: px(raw.pushbackHitDefender),
    pushbackBlockAttacker: px(raw.pushbackBlockAttacker),
    pushbackBlockDefender: px(raw.pushbackBlockDefender),
    launchVelocityY: px(raw.launchVelocityY ?? 0),
  };
}

/** One move, scaled and checked against itself. */
export function loadMove(raw: RawMove, path = `moves.${raw.key}`): MoveDef {
  if (raw.duration !== raw.startup + raw.active + raw.recovery) {
    throw new ContentError(
      `${path}.duration`,
      `is ${raw.duration} but startup + active + recovery is ${raw.startup + raw.active + raw.recovery}; the two must agree or the frame data published for this move is a fiction`,
    );
  }

  const seen = new Set<number>();
  const hitboxes = raw.hitboxes.map((h, i) => {
    if (seen.has(h.id)) {
      throw new ContentError(`${path}.hitboxes[${i}].id`, `duplicates id ${h.id} within this move`);
    }
    seen.add(h.id);
    return loadHitbox(h, raw, `${path}.hitboxes[${i}]`);
  });

  for (const [i, w] of raw.hurtboxWindows.entries()) {
    if (w.endFrame < w.startFrame) {
      throw new ContentError(`${path}.hurtboxWindows[${i}].endFrame`, "must be >= startFrame");
    }
    if (w.endFrame >= raw.duration) {
      throw new ContentError(
        `${path}.hurtboxWindows[${i}].endFrame`,
        `must be < the move's duration of ${raw.duration}`,
      );
    }
  }

  for (const [i, w] of [...raw.invulWindows, ...raw.armorWindows].entries()) {
    if (w.endFrame < w.startFrame) {
      throw new ContentError(`${path}.defenseWindows[${i}].endFrame`, "must be >= startFrame");
    }
    if (w.endFrame >= raw.duration) {
      throw new ContentError(
        `${path}.defenseWindows[${i}].endFrame`,
        `must be < the move's duration of ${raw.duration}`,
      );
    }
  }

  for (const [i, k] of raw.movement.entries()) {
    if (k.frame < 0 || k.frame >= raw.duration) {
      throw new ContentError(
        `${path}.movement[${i}].frame`,
        `must be within the move's 0..${raw.duration - 1}`,
      );
    }
  }

  return {
    id: raw.id,
    key: raw.key,
    animation: raw.animation,
    tags: raw.tags?.slice() ?? [],
    description: raw.description ?? raw.key.replaceAll("_", " "),
    duration: raw.duration,
    startup: raw.startup,
    active: raw.active,
    recovery: raw.recovery,
    requiresCrouch: raw.requiresCrouch,
    airOk: raw.airOk,
    staminaCost: raw.staminaCost,
    hitboxes,
    hurtboxWindows: raw.hurtboxWindows.map((w) => ({
      startFrame: w.startFrame,
      endFrame: w.endFrame,
      boxes: w.boxes.map(scaleBox),
    })),
    invulWindows: raw.invulWindows.map((w) => ({
      startFrame: w.startFrame,
      endFrame: w.endFrame,
      kind: INVUL_KINDS[w.kind],
    })),
    armorWindows: raw.armorWindows.map((w) => ({ ...w })),
    movement: raw.movement.map((k) => ({
      frame: k.frame,
      vx: px(k.vx),
      vy: px(k.vy),
    })),
    cancelWindows: raw.cancelWindows.map((w) => ({
      startFrame: w.startFrame,
      endFrame: w.endFrame,
      into: w.into.slice(),
      onHitOnly: w.onHitOnly,
    })),
  };
}

function loadCommand(raw: RawCharacter["commands"][number], moves: MoveDef[], path: string): CommandDef {
  if (!moves.some((m) => m.id === raw.moveId)) {
    throw new ContentError(`${path}.moveId`, `refers to move ${raw.moveId}, which this character does not have`);
  }
  let buttons = 0;
  for (const b of raw.buttons) buttons |= BUTTON_BITS[b];
  if (buttons === 0) {
    throw new ContentError(
      `${path}.buttons`,
      "must name at least one button; a command with no button has no press edge to match and could never come out",
    );
  }
  return {
    moveId: raw.moveId,
    buttons,
    motion: raw.motion.slice(),
    motionWindow: raw.motionWindow,
    requiresCrouch: raw.requiresCrouch,
    requiresAir: raw.requiresAir,
    priority: raw.priority,
  };
}

/**
 * Build a runtime fighter from its authored stat block and its move files.
 *
 * The commands are sorted by descending priority here rather than in the parser. The
 * parser runs inside the frame loop and would otherwise sort the same array on every
 * frame of every match; the order is a property of the content, so it is settled once.
 */
export function loadCharacter(raw: RawCharacter, moves: RawMove[]): CharacterDef {
  const seen = new Set<number>();
  const loaded: MoveDef[] = [];
  for (const m of moves) {
    if (seen.has(m.id)) {
      throw new ContentError(`moves.${m.key}.id`, `duplicates move id ${m.id}`);
    }
    seen.add(m.id);
    loaded.push(loadMove(m));
  }

  const commands = raw.commands.map((c, i) => loadCommand(c, loaded, `commands[${i}]`));
  commands.sort((a, b) => b.priority - a.priority);

  return {
    id: raw.id,
    name: raw.name,
    health: raw.health,
    stamina: 100,
    walkForwardSpeed: px(raw.walkForwardSpeed),
    walkBackwardSpeed: px(raw.walkBackwardSpeed),
    dashForward: {
      ...raw.dashForward,
      velocities: raw.dashForward.velocities.map(px),
    },
    dashBackward: {
      ...raw.dashBackward,
      velocities: raw.dashBackward.velocities.map(px),
    },
    jumpVelocityY: px(raw.jumpVelocityY),
    jumpVelocityXForward: px(raw.jumpVelocityXForward),
    jumpVelocityXBackward: px(raw.jumpVelocityXBackward),
    jumpSquatFrames: raw.jumpSquatFrames,
    landingFrames: raw.landingFrames,
    gravity: px(raw.gravity),
    groundFriction: px(raw.groundFriction),
    pushboxStand: scaleBox(raw.pushboxStand),
    pushboxCrouch: scaleBox(raw.pushboxCrouch),
    pushboxAir: scaleBox(raw.pushboxAir),
    hurtboxesStand: raw.hurtboxesStand.map(scaleBox),
    hurtboxesCrouch: raw.hurtboxesCrouch.map(scaleBox),
    hurtboxesAir: raw.hurtboxesAir.map(scaleBox),
    moves: loaded,
    commands,
  };
}
