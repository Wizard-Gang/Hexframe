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
 *
 * Nothing in the rig or animation types is combat data. They are declared alongside the
 * fighter because they ship in the same directory, not because the simulation reads
 * them — it never does.
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
  /** A name the renderer resolves against the animation files. The simulation ignores it. */
  animation: string;
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

/** How a player asks for a move. Motions are facing-relative numpad digits. */
export interface RawCommand {
  moveId: number;
  buttons: RawButton[];
  motion: number[];
  motionWindow: number;
  requiresCrouch: boolean;
  requiresAir: boolean;
  priority: number;
}

export interface RawDashProfile {
  /** Positive pixels-per-frame magnitudes, one authored value per dash frame. */
  velocities: number[];
  /** Zero-based first frame on which an attack may cancel the dash. */
  attackCancelFrame: number;
  recognitionWindow: number;
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
  dashForward: RawDashProfile;
  dashBackward: RawDashProfile;
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

// ---------------------------------------------------------------------------
// Presentation. Declared here, read only by src/renderer.
// ---------------------------------------------------------------------------

/**
 * One bone of the skeleton.
 *
 * `pivot` is the offset from the **parent's** pivot in world pixels, x forward and y up,
 * measured in the rest pose. The root's pivot is measured from the fighter's ground
 * origin instead. Storing offsets rather than absolute positions is what lets a parent
 * rotate and carry its children with it without any per-part correction.
 */
export interface RawRigPart {
  name: string;
  /** `null` on the root part only. */
  parent: string | null;
  pivot: { x: number; y: number };
  /** Default paint order, low to high. Far-side limbs sit below the torso, near above. */
  z: number;
}

export interface RawRig {
  /** The one part whose `parent` is `null`. */
  root: string;
  parts: RawRigPart[];
}

/**
 * A pose delta for one bone on one keyframe.
 *
 * `rotation` is degrees counter-clockwise in world space (y up) about the bone's own
 * pivot; `x` and `y` are world-pixel offsets in the same frame as the rig pivots. Every
 * field is optional because keyframes are sparse — a keyframe lists only what changed.
 */
export interface RawBonePose {
  rotation?: number;
  x?: number;
  y?: number;
}

export interface RawKeyframe {
  frame: number;
  bones: Record<string, RawBonePose>;
}

/**
 * A sparse keyframe animation. `duration` is the animation's own length in frames and is
 * deliberately unrelated to the duration of any move that names it: the renderer holds,
 * loops or interpolates as it sees fit, and the simulation never reads either number.
 */
export interface RawAnimation {
  name: string;
  loop: boolean;
  duration: number;
  /** Free-text authoring note. JSON has no comments and some of these files need one. */
  note?: string;
  keyframes: RawKeyframe[];
}
