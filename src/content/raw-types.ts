/**
 * The authored shapes: what actually sits on disk under `characters/`.
 *
 * These mirror the runtime types in `src/combat/types.ts` but in the units a designer
 * thinks in — world pixels, frames, and readable strings like `"mid"` or `"light"` —
 * rather than sim units and bitmasks. `src/content/loader.ts` is the single crossing
 * point between the two, so a person editing JSON never has to know that a pixel is a
 * hundred sim units or that `light` is `1 << 4`.
 *
 * Numbers here may carry up to two decimal places. `px()` is `Math.trunc(n * 100)`,
 * which is exact at that precision, so the conversion loses nothing and introduces no
 * float into the simulation.
 */

/** A box in fighter-local world pixels: `x` forward from the ground origin, `y` up. */
export interface RawBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** How an attack must be guarded, spelled out. Maps onto `HitLevel` in the loader. */
export type RawHitLevel = "overhead" | "mid" | "low";

/** Attack button names. Maps onto the `InputBit` attack bits in the loader. */
export type RawButton =
  | "light"
  | "medium"
  | "heavy"
  | "throw"
  | `action${1 | 2 | 3 | 4}`;

/** What a fighter cannot be touched by. Maps onto `InvulKind` in the loader. */
export type RawInvulKind = "full" | "strike" | "throw";

/** One attack box and its whole on-contact consequence, authored in pixels and frames. */
export interface RawHitbox {
  /**
   * Unique within its move. It indexes the once-per-move gate held in
   * `FighterState.hitFlags`, which is why it is a small positive integer and not a name.
   */
  id: number;
  box: RawBox;
  /** 0-based frame indices into the move, inclusive at both ends. */
  startFrame: number;
  endFrame: number;
  level: RawHitLevel;
  damage: number;
  hitstun: number;
  blockstun: number;
  hitstopAttacker: number;
  hitstopDefender: number;
  /** Pixels per frame along the **attacker's** facing, so an attacker's own value is negative. */
  pushbackHitAttacker: number;
  pushbackHitDefender: number;
  pushbackBlockAttacker: number;
  pushbackBlockDefender: number;
  launchVelocityY?: number;
}

/** Hurtboxes that replace the fighter's default set for part of a move. */
export interface RawHurtboxWindow {
  startFrame: number;
  endFrame: number;
  boxes: RawBox[];
}

export interface RawInvulWindow {
  startFrame: number;
  endFrame: number;
  kind: RawInvulKind;
}

export interface RawArmorWindow {
  startFrame: number;
  endFrame: number;
  hits: number;
}

/** A velocity set at a move frame. `vx` is along facing and the engine mirrors it. */
export interface RawMovementKey {
  frame: number;
  vx: number;
  vy: number;
}

export interface RawCancelWindow {
  startFrame: number;
  endFrame: number;
  into: number[];
  onHitOnly: boolean;
}

/** One move, authored as its own file under `characters/<id>/moves/`. */
export interface RawMove {
  id: number;
  key: string;
  tags?: string[];
  description?: string;
  duration: number;
  startup: number;
  active: number;
  recovery: number;
  requiresCrouch: boolean;
  airOk: boolean;
  hitboxes: RawHitbox[];
  hurtboxWindows: RawHurtboxWindow[];
  invulWindows: RawInvulWindow[];
  armorWindows: RawArmorWindow[];
  movement: RawMovementKey[];
  cancelWindows: RawCancelWindow[];
}

/** How a player asks for a move: authored buttons plus optional stance requirements. */
export interface RawCommand {
  moveId: number;
  buttons: RawButton[];
  requiresCrouch: boolean;
  requiresAir: boolean;
  priority: number;
}


/**
 * A fighter's authored definition. Moves live in sibling files and are handed to
 * `loadCharacter` separately: a move is edited far more often than a stat block, and
 * keeping them apart means a move change touches one small file.
 */
export interface RawCharacter {
  id: string;
  name: string;
  health: number;
  /** Pixels per frame. */
  walkForwardSpeed: number;
  walkBackwardSpeed: number;
  jumpVelocityY: number;
  jumpVelocityXForward: number;
  /** Negative means away from facing. */
  jumpVelocityXBackward: number;
  jumpSquatFrames: number;
  landingFrames: number;
  /** Pixels per frame squared, subtracted from `vy` each airborne frame. */
  gravity: number;
  /** Pixels per frame of decay applied to a residual `vx` while grounded. */
  groundFriction: number;
  pushboxStand: RawBox;
  pushboxCrouch: RawBox;
  pushboxAir: RawBox;
  hurtboxesStand: RawBox[];
  hurtboxesCrouch: RawBox[];
  hurtboxesAir: RawBox[];
  commands: RawCommand[];
}
