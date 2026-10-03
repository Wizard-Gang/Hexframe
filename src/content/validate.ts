/**
 * Structural validation of authored content, hand-written and dependency-free.
 *
 * This runs in the browser on the path that loads a fighter, so it cannot pull in a
 * schema compiler. `schemas/*.schema.json` says the same thing for `ajv` in
 * `tests/content`, and the test suite feeds both the same deliberately broken input and
 * insists they agree. Two independent statements of one rule catch the case where one of
 * them quietly drifts; a single statement trusted by everybody catches nothing.
 *
 * Two kinds of check live here. Everything JSON Schema can express — types, required
 * keys, unknown keys, enums, bounds, array lengths — is mirrored exactly by the schemas.
 * The relational checks that draft 2020-12 has no vocabulary for (`endFrame >=
 * startFrame`, keyframes in ascending order, a rig hierarchy that is actually a tree)
 * are done here as well, after the structural pass, so that any input broken in a way
 * `ajv` can see is rejected here for the same reason and at the same path.
 *
 * Errors name a path, because "expected a number" is useless and
 * "hitboxes[1].box.w: must be greater than 0" is not.
 */

import type {
  RawAnimation,
  RawArmorWindow,
  RawBonePose,
  RawBox,
  RawCancelWindow,
  RawCharacter,
  RawCommand,
  RawHitbox,
  RawHurtboxWindow,
  RawInvulWindow,
  RawKeyframe,
  RawMove,
  RawMovementKey,
  RawRig,
  RawRigPart,
} from "./raw-types";

/** Thrown for every content failure. `path` is where in the document the fault is. */
export class ContentError extends Error {
  readonly path: string;

  constructor(path: string, message: string) {
    super(path.length > 0 ? `${path}: ${message}` : message);
    this.name = "ContentError";
    this.path = path;
  }
}

// ---------------------------------------------------------------------------
// Primitive checks. Every one of these has a counterpart in the JSON Schemas.
// ---------------------------------------------------------------------------

const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

/**
 * The largest hitbox id content may use. `FighterState.hitFlags` is a 32-bit word with
 * one bit per hitbox id, so ids have to stay small; 30 leaves headroom under either
 * plausible bit assignment (`1 << id` or `1 << (id - 1)`) without reaching the sign bit.
 */
const MAX_HITBOX_ID = 30;

function field(path: string, key: string): string {
  return path.length === 0 ? key : `${path}.${key}`;
}

function at(path: string, i: number): string {
  return `${path}[${i}]`;
}

function requireObject(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ContentError(path, "must be an object");
  }
  return value as Record<string, unknown>;
}

/** The `additionalProperties: false` half of the contract. */
function requireNoExtraKeys(
  source: Record<string, unknown>,
  path: string,
  allowed: readonly string[],
): void {
  for (const key of Object.keys(source)) {
    if (!allowed.includes(key)) {
      throw new ContentError(field(path, key), "is not a recognised property");
    }
  }
}

function requirePresent(source: Record<string, unknown>, path: string, key: string): unknown {
  if (!Object.prototype.hasOwnProperty.call(source, key)) {
    throw new ContentError(field(path, key), "is required");
  }
  return source[key];
}

function requireNumber(source: Record<string, unknown>, path: string, key: string): number {
  const value = requirePresent(source, path, key);
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ContentError(field(path, key), "must be a finite number");
  }
  return value;
}

function requireInteger(source: Record<string, unknown>, path: string, key: string): number {
  const value = requirePresent(source, path, key);
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new ContentError(field(path, key), "must be an integer");
  }
  return value;
}

function requireIntegerInRange(
  source: Record<string, unknown>,
  path: string,
  key: string,
  min: number,
  max: number,
): number {
  const value = requireInteger(source, path, key);
  if (value < min || value > max) {
    throw new ContentError(field(path, key), `must be between ${min} and ${max} inclusive`);
  }
  return value;
}

function requireIntegerAtLeast(
  source: Record<string, unknown>,
  path: string,
  key: string,
  min: number,
): number {
  const value = requireInteger(source, path, key);
  if (value < min) {
    throw new ContentError(field(path, key), `must be >= ${min}`);
  }
  return value;
}

function requireNumberAtLeast(
  source: Record<string, unknown>,
  path: string,
  key: string,
  min: number,
): number {
  const value = requireNumber(source, path, key);
  if (value < min) {
    throw new ContentError(field(path, key), `must be >= ${min}`);
  }
  return value;
}

function requireNumberAbove(
  source: Record<string, unknown>,
  path: string,
  key: string,
  bound: number,
): number {
  const value = requireNumber(source, path, key);
  if (value <= bound) {
    throw new ContentError(field(path, key), `must be greater than ${bound}`);
  }
  return value;
}

function requireBoolean(source: Record<string, unknown>, path: string, key: string): boolean {
  const value = requirePresent(source, path, key);
  if (typeof value !== "boolean") {
    throw new ContentError(field(path, key), "must be a boolean");
  }
  return value;
}

function requireNonEmptyString(
  source: Record<string, unknown>,
  path: string,
  key: string,
): string {
  const value = requirePresent(source, path, key);
  if (typeof value !== "string" || value.length === 0) {
    throw new ContentError(field(path, key), "must be a non-empty string");
  }
  return value;
}

function requireIdentifier(source: Record<string, unknown>, path: string, key: string): string {
  const value = requireNonEmptyString(source, path, key);
  if (!KEY_PATTERN.test(value)) {
    throw new ContentError(field(path, key), "must be lowercase letters, digits and underscores");
  }
  return value;
}

function requireEnum<T extends string>(
  source: Record<string, unknown>,
  path: string,
  key: string,
  allowed: readonly T[],
): T {
  const value = requirePresent(source, path, key);
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new ContentError(field(path, key), `must be one of ${allowed.join(", ")}`);
  }
  return value as T;
}

function requireArray(
  source: Record<string, unknown>,
  path: string,
  key: string,
  minItems: number,
): unknown[] {
  const value = requirePresent(source, path, key);
  if (!Array.isArray(value)) {
    throw new ContentError(field(path, key), "must be an array");
  }
  if (value.length < minItems) {
    throw new ContentError(field(path, key), `must have at least ${minItems} item(s)`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Composite shapes
// ---------------------------------------------------------------------------

const BOX_KEYS = ["x", "y", "w", "h"] as const;

function readBox(value: unknown, path: string): RawBox {
  const source = requireObject(value, path);
  requireNoExtraKeys(source, path, BOX_KEYS);
  return {
    x: requireNumber(source, path, "x"),
    y: requireNumber(source, path, "y"),
    // A zero-width or zero-height box can never overlap anything, so authoring one is
    // always a mistake rather than a way of disabling a box.
    w: requireNumberAbove(source, path, "w", 0),
    h: requireNumberAbove(source, path, "h", 0),
  };
}

function readBoxAt(source: Record<string, unknown>, path: string, key: string): RawBox {
  return readBox(requirePresent(source, path, key), field(path, key));
}

function readBoxArray(
  source: Record<string, unknown>,
  path: string,
  key: string,
  minItems: number,
): RawBox[] {
  const items = requireArray(source, path, key, minItems);
  const listPath = field(path, key);
  return items.map((item, i) => readBox(item, at(listPath, i)));
}

const HITBOX_KEYS = [
  "id",
  "box",
  "startFrame",
  "endFrame",
  "level",
  "damage",
  "hitstun",
  "blockstun",
  "hitstopAttacker",
  "hitstopDefender",
  "pushbackHitAttacker",
  "pushbackHitDefender",
  "pushbackBlockAttacker",
  "pushbackBlockDefender",
  "launchVelocityY",
] as const;

function readHitbox(value: unknown, path: string): RawHitbox {
  const source = requireObject(value, path);
  requireNoExtraKeys(source, path, HITBOX_KEYS);
  const hitbox: RawHitbox = {
    id: requireIntegerInRange(source, path, "id", 1, MAX_HITBOX_ID),
    box: readBoxAt(source, path, "box"),
    startFrame: requireIntegerAtLeast(source, path, "startFrame", 0),
    endFrame: requireIntegerAtLeast(source, path, "endFrame", 0),
    level: requireEnum(source, path, "level", ["overhead", "mid", "low"] as const),
    damage: requireIntegerAtLeast(source, path, "damage", 0),
    hitstun: requireIntegerAtLeast(source, path, "hitstun", 0),
    blockstun: requireIntegerAtLeast(source, path, "blockstun", 0),
    hitstopAttacker: requireIntegerAtLeast(source, path, "hitstopAttacker", 0),
    hitstopDefender: requireIntegerAtLeast(source, path, "hitstopDefender", 0),
    pushbackHitAttacker: requireNumber(source, path, "pushbackHitAttacker"),
    pushbackHitDefender: requireNumber(source, path, "pushbackHitDefender"),
    pushbackBlockAttacker: requireNumber(source, path, "pushbackBlockAttacker"),
    pushbackBlockDefender: requireNumber(source, path, "pushbackBlockDefender"),
    launchVelocityY: source["launchVelocityY"] === undefined
      ? 0
      : requireNumberAtLeast(source, path, "launchVelocityY", 0),
  };
  if (hitbox.endFrame < hitbox.startFrame) {
    throw new ContentError(field(path, "endFrame"), "must be >= startFrame");
  }
  return hitbox;
}

const ARMOR_WINDOW_KEYS = ["startFrame", "endFrame", "hits"] as const;

function readArmorWindow(value: unknown, path: string): RawArmorWindow {
  const source = requireObject(value, path);
  requireNoExtraKeys(source, path, ARMOR_WINDOW_KEYS);
  const window: RawArmorWindow = {
    startFrame: requireIntegerAtLeast(source, path, "startFrame", 0),
    endFrame: requireIntegerAtLeast(source, path, "endFrame", 0),
    hits: requireIntegerAtLeast(source, path, "hits", 1),
  };
  if (window.endFrame < window.startFrame) {
    throw new ContentError(field(path, "endFrame"), "must be >= startFrame");
  }
  return window;
}

const HURTBOX_WINDOW_KEYS = ["startFrame", "endFrame", "boxes"] as const;

function readHurtboxWindow(value: unknown, path: string): RawHurtboxWindow {
  const source = requireObject(value, path);
  requireNoExtraKeys(source, path, HURTBOX_WINDOW_KEYS);
  const window: RawHurtboxWindow = {
    startFrame: requireIntegerAtLeast(source, path, "startFrame", 0),
    endFrame: requireIntegerAtLeast(source, path, "endFrame", 0),
    boxes: readBoxArray(source, path, "boxes", 1),
  };
  if (window.endFrame < window.startFrame) {
    throw new ContentError(field(path, "endFrame"), "must be >= startFrame");
  }
  return window;
}

const INVUL_WINDOW_KEYS = ["startFrame", "endFrame", "kind"] as const;

function readInvulWindow(value: unknown, path: string): RawInvulWindow {
  const source = requireObject(value, path);
  requireNoExtraKeys(source, path, INVUL_WINDOW_KEYS);
  const window: RawInvulWindow = {
    startFrame: requireIntegerAtLeast(source, path, "startFrame", 0),
    endFrame: requireIntegerAtLeast(source, path, "endFrame", 0),
    kind: requireEnum(source, path, "kind", ["full", "strike", "throw"] as const),
  };
  if (window.endFrame < window.startFrame) {
    throw new ContentError(field(path, "endFrame"), "must be >= startFrame");
  }
  return window;
}

const MOVEMENT_KEY_KEYS = ["frame", "vx", "vy"] as const;

function readMovementKey(value: unknown, path: string): RawMovementKey {
  const source = requireObject(value, path);
  requireNoExtraKeys(source, path, MOVEMENT_KEY_KEYS);
  return {
    frame: requireIntegerAtLeast(source, path, "frame", 0),
    vx: requireNumber(source, path, "vx"),
    vy: requireNumber(source, path, "vy"),
  };
}

const CANCEL_WINDOW_KEYS = ["startFrame", "endFrame", "into", "onHitOnly"] as const;

function readCancelWindow(value: unknown, path: string): RawCancelWindow {
  const source = requireObject(value, path);
  requireNoExtraKeys(source, path, CANCEL_WINDOW_KEYS);
  const intoPath = field(path, "into");
  const intoItems = requireArray(source, path, "into", 1);
  const into = intoItems.map((item, i) => {
    if (typeof item !== "number" || !Number.isInteger(item) || item < 1) {
      throw new ContentError(at(intoPath, i), "must be a move id, an integer >= 1");
    }
    return item;
  });
  const window: RawCancelWindow = {
    startFrame: requireIntegerAtLeast(source, path, "startFrame", 0),
    endFrame: requireIntegerAtLeast(source, path, "endFrame", 0),
    into,
    onHitOnly: requireBoolean(source, path, "onHitOnly"),
  };
  if (window.endFrame < window.startFrame) {
    throw new ContentError(field(path, "endFrame"), "must be >= startFrame");
  }
  return window;
}

const COMMAND_KEYS = [
  "moveId",
  "buttons",
  "requiresCrouch",
  "requiresAir",
  "priority",
] as const;

const BUTTON_NAMES = [
  "light", "medium", "heavy", "throw",
  "action1", "action2", "action3", "action4",
] as const;

function readCommand(value: unknown, path: string): RawCommand {
  const source = requireObject(value, path);
  requireNoExtraKeys(source, path, COMMAND_KEYS);

  const buttonsPath = field(path, "buttons");
  const buttonItems = requireArray(source, path, "buttons", 1);
  const buttons = buttonItems.map((item, i) => {
    if (typeof item !== "string" || !(BUTTON_NAMES as readonly string[]).includes(item)) {
      throw new ContentError(at(buttonsPath, i), `must be one of ${BUTTON_NAMES.join(", ")}`);
    }
    return item as (typeof BUTTON_NAMES)[number];
  });
  if (new Set(buttons).size !== buttons.length) {
    throw new ContentError(buttonsPath, "must not repeat a button");
  }


  return {
    moveId: requireIntegerAtLeast(source, path, "moveId", 1),
    buttons,
    requiresCrouch: requireBoolean(source, path, "requiresCrouch"),
    requiresAir: requireBoolean(source, path, "requiresAir"),
    priority: requireInteger(source, path, "priority"),
  };
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

const CHARACTER_KEYS = [
  "id",
  "name",
  "health",
  "walkForwardSpeed",
  "walkBackwardSpeed",
  "jumpVelocityY",
  "jumpVelocityXForward",
  "jumpVelocityXBackward",
  "jumpSquatFrames",
  "landingFrames",
  "gravity",
  "groundFriction",
  "pushboxStand",
  "pushboxCrouch",
  "pushboxAir",
  "hurtboxesStand",
  "hurtboxesCrouch",
  "hurtboxesAir",
  "commands",
] as const;

/**
 * Validate a `character.json`. The optional `path` is a prefix for the error paths, so a
 * caller that already knows where the document sits — `loadCharacter` does — can produce
 * `moves[0].hitboxes[1].endFrame` rather than a path that starts nowhere.
 */
export function validateCharacter(raw: unknown, path = ""): RawCharacter {
  const source = requireObject(raw, path);
  requireNoExtraKeys(source, path, CHARACTER_KEYS);

  const commandsPath = field(path, "commands");
  const commandItems = requireArray(source, path, "commands", 1);
  const commands = commandItems.map((item, i) => readCommand(item, at(commandsPath, i)));

  return {
    id: requireIdentifier(source, path, "id"),
    name: requireNonEmptyString(source, path, "name"),
    health: requireIntegerAtLeast(source, path, "health", 1),
    walkForwardSpeed: requireNumberAtLeast(source, path, "walkForwardSpeed", 0),
    walkBackwardSpeed: requireNumberAtLeast(source, path, "walkBackwardSpeed", 0),
    jumpVelocityY: requireNumberAtLeast(source, path, "jumpVelocityY", 0),
    jumpVelocityXForward: requireNumber(source, path, "jumpVelocityXForward"),
    jumpVelocityXBackward: requireNumber(source, path, "jumpVelocityXBackward"),
    jumpSquatFrames: requireIntegerAtLeast(source, path, "jumpSquatFrames", 0),
    landingFrames: requireIntegerAtLeast(source, path, "landingFrames", 0),
    // Zero gravity would leave a jumping fighter airborne forever, but that is a design
    // decision the engine can survive; a negative one is simply wrong.
    gravity: requireNumberAtLeast(source, path, "gravity", 0),
    groundFriction: requireNumberAtLeast(source, path, "groundFriction", 0),
    pushboxStand: readBoxAt(source, path, "pushboxStand"),
    pushboxCrouch: readBoxAt(source, path, "pushboxCrouch"),
    pushboxAir: readBoxAt(source, path, "pushboxAir"),
    hurtboxesStand: readBoxArray(source, path, "hurtboxesStand", 1),
    hurtboxesCrouch: readBoxArray(source, path, "hurtboxesCrouch", 1),
    hurtboxesAir: readBoxArray(source, path, "hurtboxesAir", 1),
    commands,
  };
}

const MOVE_KEYS = [
  "id",
  "key",
  "animation",
  "tags",
  "description",
  "duration",
  "startup",
  "active",
  "recovery",
  "requiresCrouch",
  "airOk",
  "hitboxes",
  "hurtboxWindows",
  "invulWindows",
  "armorWindows",
  "movement",
  "cancelWindows",
] as const;

/** Validate one move file. See `validateCharacter` for what `path` is for. */
export function validateMove(raw: unknown, path = ""): RawMove {
  const source = requireObject(raw, path);
  requireNoExtraKeys(source, path, MOVE_KEYS);

  const hitboxesPath = field(path, "hitboxes");
  const hitboxes = requireArray(source, path, "hitboxes", 0).map((item, i) =>
    readHitbox(item, at(hitboxesPath, i)),
  );

  const hurtboxWindowsPath = field(path, "hurtboxWindows");
  const hurtboxWindows = requireArray(source, path, "hurtboxWindows", 0).map((item, i) =>
    readHurtboxWindow(item, at(hurtboxWindowsPath, i)),
  );

  const invulWindowsPath = field(path, "invulWindows");
  const invulWindows = requireArray(source, path, "invulWindows", 0).map((item, i) =>
    readInvulWindow(item, at(invulWindowsPath, i)),
  );

  const armorWindowsPath = field(path, "armorWindows");
  const armorWindows = requireArray(source, path, "armorWindows", 0).map((item, i) =>
    readArmorWindow(item, at(armorWindowsPath, i)),
  );

  const movementPath = field(path, "movement");
  const movement = requireArray(source, path, "movement", 0).map((item, i) =>
    readMovementKey(item, at(movementPath, i)),
  );

  const cancelWindowsPath = field(path, "cancelWindows");
  const cancelWindows = requireArray(source, path, "cancelWindows", 0).map((item, i) =>
    readCancelWindow(item, at(cancelWindowsPath, i)),
  );

  const tagsValue = source["tags"];
  const tags = tagsValue === undefined
    ? []
    : requireArray(source, path, "tags", 0).map((tag, index) => {
        if (typeof tag !== "string" || !KEY_PATTERN.test(tag)) {
          throw new ContentError(at(field(path, "tags"), index), "must be a lowercase tag");
        }
        return tag;
      });

  return {
    id: requireIntegerAtLeast(source, path, "id", 1),
    key: requireIdentifier(source, path, "key"),
    animation: requireIdentifier(source, path, "animation"),
    tags,
    description: source["description"] === undefined
      ? ""
      : requireNonEmptyString(source, path, "description"),
    duration: requireIntegerAtLeast(source, path, "duration", 1),
    startup: requireIntegerAtLeast(source, path, "startup", 0),
    active: requireIntegerAtLeast(source, path, "active", 0),
    recovery: requireIntegerAtLeast(source, path, "recovery", 0),
    requiresCrouch: requireBoolean(source, path, "requiresCrouch"),
    airOk: requireBoolean(source, path, "airOk"),
    hitboxes,
    hurtboxWindows,
    invulWindows,
    armorWindows,
    movement,
    cancelWindows,
  };
}

const RIG_PART_KEYS = ["name", "parent", "pivot", "z"] as const;
const PIVOT_KEYS = ["x", "y"] as const;

function readRigPart(value: unknown, path: string): RawRigPart {
  const source = requireObject(value, path);
  requireNoExtraKeys(source, path, RIG_PART_KEYS);

  const parentValue = requirePresent(source, path, "parent");
  if (parentValue !== null && (typeof parentValue !== "string" || !KEY_PATTERN.test(parentValue))) {
    throw new ContentError(field(path, "parent"), "must be a part name or null");
  }

  const pivotPath = field(path, "pivot");
  const pivotSource = requireObject(requirePresent(source, path, "pivot"), pivotPath);
  requireNoExtraKeys(pivotSource, pivotPath, PIVOT_KEYS);

  return {
    name: requireIdentifier(source, path, "name"),
    parent: parentValue,
    pivot: {
      x: requireNumber(pivotSource, pivotPath, "x"),
      y: requireNumber(pivotSource, pivotPath, "y"),
    },
    z: requireInteger(source, path, "z"),
  };
}

const RIG_KEYS = ["root", "parts"] as const;

/**
 * Validate a `rig.json`, including that the parts really form a single rooted tree.
 * A rig with a cycle or a dangling parent would send the renderer's transform walk into
 * an infinite loop, and catching it at the door is much cheaper than defending every
 * traversal against it.
 */
export function validateRig(raw: unknown, path = ""): RawRig {
  const source = requireObject(raw, path);
  requireNoExtraKeys(source, path, RIG_KEYS);

  const root = requireIdentifier(source, path, "root");
  const partsPath = field(path, "parts");
  const parts = requireArray(source, path, "parts", 1).map((item, i) =>
    readRigPart(item, at(partsPath, i)),
  );

  const byName = new Map<string, RawRigPart>();
  parts.forEach((part, i) => {
    if (byName.has(part.name)) {
      throw new ContentError(field(at(partsPath, i), "name"), `duplicates an earlier part`);
    }
    byName.set(part.name, part);
  });

  if (!byName.has(root)) {
    throw new ContentError(field(path, "root"), `names a part that does not exist: ${root}`);
  }

  parts.forEach((part, i) => {
    const partPath = at(partsPath, i);
    if (part.parent === null) {
      if (part.name !== root) {
        throw new ContentError(field(partPath, "parent"), "only the root part may have no parent");
      }
      return;
    }
    if (part.name === root) {
      throw new ContentError(field(partPath, "parent"), "the root part must have no parent");
    }
    if (!byName.has(part.parent)) {
      throw new ContentError(
        field(partPath, "parent"),
        `names a part that does not exist: ${part.parent}`,
      );
    }
  });

  // Every part must reach the root by walking parents. The step budget is the number of
  // parts, so a cycle is detected without keeping a visited set per walk.
  parts.forEach((part, i) => {
    let cursor: RawRigPart = part;
    for (let steps = 0; steps <= parts.length; steps++) {
      if (cursor.parent === null) return;
      const parent = byName.get(cursor.parent);
      if (parent === undefined) return;
      cursor = parent;
    }
    throw new ContentError(at(partsPath, i), `is part of a parent cycle`);
  });

  return { root, parts };
}

const KEYFRAME_KEYS = ["frame", "bones"] as const;
const BONE_POSE_KEYS = ["rotation", "x", "y"] as const;

function readBonePose(value: unknown, path: string): RawBonePose {
  const source = requireObject(value, path);
  requireNoExtraKeys(source, path, BONE_POSE_KEYS);
  if (Object.keys(source).length === 0) {
    throw new ContentError(path, "must set at least one of rotation, x, y");
  }
  const pose: RawBonePose = {};
  if (Object.prototype.hasOwnProperty.call(source, "rotation")) {
    pose.rotation = requireNumber(source, path, "rotation");
  }
  if (Object.prototype.hasOwnProperty.call(source, "x")) {
    pose.x = requireNumber(source, path, "x");
  }
  if (Object.prototype.hasOwnProperty.call(source, "y")) {
    pose.y = requireNumber(source, path, "y");
  }
  return pose;
}

function readKeyframe(value: unknown, path: string): RawKeyframe {
  const source = requireObject(value, path);
  requireNoExtraKeys(source, path, KEYFRAME_KEYS);

  const frame = requireIntegerAtLeast(source, path, "frame", 0);
  const bonesPath = field(path, "bones");
  const bonesSource = requireObject(requirePresent(source, path, "bones"), bonesPath);

  const bones: Record<string, RawBonePose> = {};
  const boneNames = Object.keys(bonesSource);
  if (boneNames.length === 0) {
    throw new ContentError(bonesPath, "must pose at least one bone");
  }
  for (const boneName of boneNames) {
    if (!KEY_PATTERN.test(boneName)) {
      throw new ContentError(
        field(bonesPath, boneName),
        "is not a valid part name: lowercase letters, digits and underscores",
      );
    }
    bones[boneName] = readBonePose(bonesSource[boneName], field(bonesPath, boneName));
  }

  return { frame, bones };
}

const ANIMATION_KEYS = ["name", "loop", "duration", "note", "keyframes"] as const;

/**
 * Validate one animation file.
 *
 * Note what is *not* checked: nothing here compares `duration` against any move, because
 * the two are deliberately independent. An animation is free to be longer or shorter
 * than the move that names it, and `tests/content` asserts exactly that.
 */
export function validateAnimation(raw: unknown, path = ""): RawAnimation {
  const source = requireObject(raw, path);
  requireNoExtraKeys(source, path, ANIMATION_KEYS);

  const keyframesPath = field(path, "keyframes");
  const keyframes = requireArray(source, path, "keyframes", 1).map((item, i) =>
    readKeyframe(item, at(keyframesPath, i)),
  );

  const animation: RawAnimation = {
    name: requireIdentifier(source, path, "name"),
    loop: requireBoolean(source, path, "loop"),
    duration: requireIntegerAtLeast(source, path, "duration", 1),
    keyframes,
  };

  if (Object.prototype.hasOwnProperty.call(source, "note")) {
    animation.note = requireNonEmptyString(source, path, "note");
  }

  if (keyframes[0].frame !== 0) {
    throw new ContentError(
      field(at(keyframesPath, 0), "frame"),
      "the first keyframe must be frame 0, so a pose is defined at the start",
    );
  }

  for (let i = 1; i < keyframes.length; i++) {
    if (keyframes[i].frame <= keyframes[i - 1].frame) {
      throw new ContentError(
        field(at(keyframesPath, i), "frame"),
        "keyframes must be in strictly ascending frame order",
      );
    }
  }

  const last = keyframes[keyframes.length - 1].frame;
  if (last > animation.duration) {
    throw new ContentError(
      field(at(keyframesPath, keyframes.length - 1), "frame"),
      `must not be past the animation duration of ${animation.duration}`,
    );
  }

  return animation;
}
