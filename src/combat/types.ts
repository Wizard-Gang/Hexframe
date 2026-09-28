/**
 * The shape of everything the simulation stores, reads or emits.
 *
 * This file is a contract. Every other module in `src/combat`, `src/input`,
 * `src/rollback`, `src/renderer` and `src/lab` is written against it, so changing a
 * field here changes the snapshot layout, the determinism hash and the wire format at
 * once. Add fields at the end of a structure and bump `SNAPSHOT_VERSION`.
 *
 * Two separations are load-bearing and are stated here rather than left to discipline:
 *
 *  - **Visual data is not combat data.** Nothing in this file describes a bone, a
 *    rotation or an interpolation. `MoveDef.animation` is a name the renderer looks up;
 *    the simulation never reads the animation it points at.
 *  - **Simulation state is not simulation output.** `SimState` is hashed, snapshotted
 *    and rolled back. `FrameReport` is what happened during one step, for the renderer
 *    and the lab to look at, and is never part of the hash.
 */

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/**
 * One frame of input for one player, as a bitmask of `InputBit` values.
 *
 * Directions are **absolute** (left and right, not forward and back). The command
 * parser converts them to facing-relative numpad notation. Absolute is what gets
 * networked, recorded and hashed, because it is what the player physically did and it
 * stays meaningful when a rollback changes which way the fighter was facing.
 */
export type InputFrame = number;

export const InputBit = {
  Up: 1 << 0,
  Down: 1 << 1,
  Left: 1 << 2,
  Right: 1 << 3,
  Action1: 1 << 4,
  Action2: 1 << 5,
  Action3: 1 << 6,
  Action4: 1 << 7,
  Action5: 1 << 8,
  Action6: 1 << 9,
  Action7: 1 << 10,
  Action8: 1 << 11,
  Action9: 1 << 12,
  Action10: 1 << 13,
  Action11: 1 << 14,
  Action12: 1 << 15,
  Action13: 1 << 16,
  Action14: 1 << 17,
  Action15: 1 << 18,
  Action16: 1 << 19,
  // Compatibility names for authored 0.1 content and existing replay scripts.
  Light: 1 << 4,
  Medium: 1 << 5,
  Heavy: 1 << 6,
  Throw: 1 << 7,
} as const;

export const ACTION_SLOT_COUNT = 16;

/** The input bit for a zero-based action slot. Invalid slots map to no input. */
export function actionBit(slot: number): number {
  if (!Number.isInteger(slot) || slot < 0 || slot >= ACTION_SLOT_COUNT) return 0;
  return 1 << (slot + 4);
}

/** Every bit the engine defines. Anything outside this mask is dropped on the way in. */
export const INPUT_MASK = (1 << (ACTION_SLOT_COUNT + 4)) - 1;

/** All attack buttons, for "is any attack pressed" tests. */
export const ATTACK_BUTTONS = ((1 << ACTION_SLOT_COUNT) - 1) << 4;

/** All directions. */
export const DIRECTION_BITS = InputBit.Up | InputBit.Down | InputBit.Left | InputBit.Right;

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/** Which way a fighter faces. `1` is toward increasing x, `-1` toward decreasing x. */
export type Facing = 1 | -1;

/**
 * A box in **fighter-local space**, in sim units.
 *
 * `x` runs *forward* — in the direction the fighter faces — from the fighter's ground
 * origin, and `y` runs up from the ground. This is why a move is authored once and
 * never as a left and a right variant: mirroring is `facing === 1 ? x : -x - w`.
 */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A resolved, world-space, axis-aligned box. `x0 < x1` and `y0 < y1` always hold. */
export interface Aabb {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** How an attack must be guarded. */
export const HitLevel = {
  /** Overhead: must be blocked standing. */
  Overhead: 0,
  /** Mid: blocked standing or crouching. */
  Mid: 1,
  /** Low: must be blocked crouching. */
  Low: 2,
} as const;
export type HitLevelValue = (typeof HitLevel)[keyof typeof HitLevel];

// ---------------------------------------------------------------------------
// Move data (runtime form — sim units, already scaled by the content loader)
// ---------------------------------------------------------------------------

/**
 * One attack box and everything that happens when it connects.
 *
 * Frame numbers are 0-based indices into the move, inclusive at both ends, and are
 * compared against `FighterState.moveFrame`.
 */
export interface HitboxSpec {
  /** Unique within its move. Indexes the aggregate and per-target hit gates. */
  id: number;
  box: Box;
  startFrame: number;
  endFrame: number;
  level: HitLevelValue;
  damage: number;
  hitstun: number;
  blockstun: number;
  hitstopAttacker: number;
  hitstopDefender: number;
  /** Velocity applied on contact, in sim units per frame, along the attacker's facing. */
  pushbackHitAttacker: number;
  pushbackHitDefender: number;
  pushbackBlockAttacker: number;
  pushbackBlockDefender: number;
  /** Upward launch applied to an unblocked defender, in sim units per frame. */
  launchVelocityY: number;
}

/** Hurtboxes that replace the fighter's default ones for part of a move. */
export interface HurtboxWindow {
  startFrame: number;
  endFrame: number;
  boxes: Box[];
}

/** What a fighter cannot be touched by during part of a move. */
export const InvulKind = { Full: 0, Strike: 1, Throw: 2 } as const;
export type InvulKindValue = (typeof InvulKind)[keyof typeof InvulKind];

export interface InvulWindow {
  startFrame: number;
  endFrame: number;
  kind: InvulKindValue;
}

/** A finite number of strikes a move can absorb without entering hitstun. */
export interface ArmorWindow {
  startFrame: number;
  endFrame: number;
  hits: number;
}

/**
 * A velocity change scheduled at a move frame. `vx` is along the fighter's facing and is
 * mirrored automatically; `vy` is world-up. Applied as a set, not an add.
 */
export interface MovementKey {
  frame: number;
  vx: number;
  vy: number;
}

/** A window in which this move may be cancelled into another. */
export interface CancelWindow {
  startFrame: number;
  endFrame: number;
  /** Move ids this may cancel into. */
  into: number[];
  /** When true the cancel is only available if the move has already connected. */
  onHitOnly: boolean;
}

/** A move: what the game *does*. Its `animation` is only a name the renderer resolves. */
export interface MoveDef {
  id: number;
  key: string;
  animation: string;
  /** Searchable build-crafting vocabulary: fire, burn, projectile, guard-break, and so on. */
  tags: string[];
  /** Short player-facing explanation used by the loadout builder. */
  description: string;
  duration: number;
  startup: number;
  active: number;
  recovery: number;
  /** True for crouching normals: the move only comes out, and stays, while crouching. */
  requiresCrouch: boolean;
  /** True for air normals. */
  airOk: boolean;
  /** Deterministic resource cost paid once when the move starts. */
  staminaCost: number;
  hitboxes: HitboxSpec[];
  hurtboxWindows: HurtboxWindow[];
  invulWindows: InvulWindow[];
  armorWindows: ArmorWindow[];
  movement: MovementKey[];
  cancelWindows: CancelWindow[];
}

/** How a player asks for a move. Motions are facing-relative numpad digits. */
export interface CommandDef {
  moveId: number;
  /**
   * Button bits. The command is eligible on a frame where any of these buttons went
   * from released to pressed, within `INPUT_BUFFER_FRAMES` of that press.
   */
  buttons: number;
  /** Numpad sequence, e.g. `[2, 3, 6]` for a quarter-circle forward. Empty for normals. */
  motion: number[];
  /** How many frames the whole motion may take. Ignored when `motion` is empty. */
  motionWindow: number;
  requiresCrouch: boolean;
  requiresAir: boolean;
  /** Higher wins when several commands match on the same frame. */
  priority: number;
}

/** A fighter's complete combat definition, in sim units. */
export interface CharacterDef {
  id: string;
  name: string;
  /** Maximum health. */
  health: number;
  /** Maximum stamina. */
  stamina: number;
  walkForwardSpeed: number;
  walkBackwardSpeed: number;
  dashForward: DashProfile;
  dashBackward: DashProfile;
  jumpVelocityY: number;
  jumpVelocityXForward: number;
  jumpVelocityXBackward: number;
  jumpSquatFrames: number;
  landingFrames: number;
  gravity: number;
  /** Per-frame decay applied to residual horizontal velocity while grounded. */
  groundFriction: number;
  pushboxStand: Box;
  pushboxCrouch: Box;
  pushboxAir: Box;
  hurtboxesStand: Box[];
  hurtboxesCrouch: Box[];
  hurtboxesAir: Box[];
  moves: MoveDef[];
  commands: CommandDef[];
}

/** Authored per-frame ground speed and cancel rules for one dash direction. */
export interface DashProfile {
  velocities: number[];
  attackCancelFrame: number;
  staminaCost: number;
  recognitionWindow: number;
}

// ---------------------------------------------------------------------------
// Simulation state — hashed, snapshotted, rolled back
// ---------------------------------------------------------------------------

export const StateId = {
  Idle: 0,
  WalkForward: 1,
  WalkBackward: 2,
  Crouch: 3,
  JumpSquat: 4,
  Airborne: 5,
  Landing: 6,
  Attack: 7,
  HitstunStand: 8,
  HitstunCrouch: 9,
  HitstunAir: 10,
  BlockstunStand: 11,
  BlockstunCrouch: 12,
  Dash: 13,
  Knockdown: 14,
  GuardBreak: 15,
  Defeat: 16,
} as const;
export type StateIdValue = (typeof StateId)[keyof typeof StateId];

/**
 * One fighter, entirely as integers.
 *
 * Every field here is serialised, hashed and restored. Nothing derived from rendering,
 * from wall-clock time or from the browser may be added to it.
 */
export interface FighterState {
  /** Ground origin, sim units. `y` is height above the ground; `GROUND_Y` when standing. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: Facing;
  state: StateIdValue;
  /** Frames spent in the current state, starting at 0 on the frame it was entered. */
  stateFrame: number;
  /** `NO_MOVE` when not attacking. */
  moveId: number;
  /** 0-based frame within the current move. Frozen while `hitstop > 0`. */
  moveFrame: number;
  /** Frames of hitstop left. While non-zero the fighter's move and physics are frozen. */
  hitstop: number;
  /** Frames of hitstun or blockstun left, depending on `state`. */
  stun: number;
  health: number;
  /** Current spendable stamina, clamped to the character's resolved maximum. */
  stamina: number;
  /** Frames before stamina regeneration resumes after a spend. */
  staminaRegenDelay: number;
  /** 1 when off the ground. Redundant with `y` by design: it survives moves that lift. */
  airborne: number;
  /** Aggregate bitmask of hitboxes that connected with any target during this move. */
  hitFlags: number;
  /** Hits taken since the defender was last actionable. Drives combo display and scaling. */
  comboCount: number;
  /** Number of hits absorbed by the current move's hyper-armor windows. */
  armorHits: number;
  /**
   * Absolute frame of the most recent button press that has already been turned into a
   * move. Without it the input buffer would fire the same press on every frame of its
   * window; with it, a press produces exactly one move however early it was made.
   */
  bufferConsumedFrame: number;
  /** 1 for a forward dash, 0 for a backdash. Meaningful only in `StateId.Dash`. */
  dashForward: number;
  /** Deterministic stack counts and lifetimes for tag-driven status effects. */
  burnStacks: number;
  burnFrames: number;
  poisonStacks: number;
  poisonFrames: number;
  freezeStacks: number;
  freezeFrames: number;
  shockStacks: number;
  shockFrames: number;
  bleedStacks: number;
  bleedFrames: number;
}

export interface StageDef {
  id: "training-grid";
  width: number;
  cameraBounds: { minX: number; maxX: number };
}

export interface StageState {
  worldMinX: number;
  worldMaxX: number;
}

/** The complete authoritative state of a match on one frame. */
export interface SimState {
  frame: number;
  /** Deterministic RNG word. Part of the state, so a rollback replays the same rolls. */
  rng: number;
  /** One entry per configured fighter, in fighter-index order. */
  fighters: FighterState[];
  stage: StageState;
  /** 1 once either fighter has been defeated. The lab does not stop the clock. */
  roundOver: number;
  /**
   * The last `COMMAND_HISTORY_FRAMES` input frames per player, as a ring indexed by
   * `frame % COMMAND_HISTORY_FRAMES`, in player-index order.
   *
   * Command parsing happens *inside* `Simulation.step()` — step 2 of the frame loop —
   * so the history the parser reads is authoritative simulation state. Keeping it here
   * rather than in a client-side object is what makes a rollback re-derive the same
   * moves from the same presses instead of trusting the caller to replay a parser.
   */
  inputHistory: number[][];
}

// ---------------------------------------------------------------------------
// Simulation output — never hashed
// ---------------------------------------------------------------------------

export const ContactKind = { Hit: 0, Block: 1 } as const;
export type ContactKindValue = (typeof ContactKind)[keyof typeof ContactKind];

export interface ContactEvent {
  attacker: number;
  defender: number;
  moveId: number;
  hitboxId: number;
  /** Zero-based index of the resolved defender hurtbox for this frame. */
  hurtboxId: number;
  kind: ContactKindValue;
  level: HitLevelValue;
  /** Damage dealt by the authored move and status interactions. */
  damage: number;
  rawDamage: number;
  hitstun: number;
  blockstun: number;
  hitstopAttacker: number;
  hitstopDefender: number;
  /** Actual signed horizontal velocities applied by resolution, in sim units/frame. */
  pushbackAttacker: number;
  pushbackDefender: number;
  /** Shared AABB area, retained so the inspector never has to recreate the collision. */
  overlapWidth: number;
  overlapHeight: number;
  /** True when the defender was attacking at the instant the boxes touched. */
  counterHit: boolean;
  /** True when damage landed but a hyper-armor point prevented hitstun. */
  armored: boolean;
  /** Stamina removed by this guard contact. Zero on a perfect guard. */
  guardStaminaDamage: number;
  perfectGuard: boolean;
  guardBreak: boolean;
  /** Approximate world point of contact, for the renderer's effects. */
  x: number;
  y: number;
}

export const DebuffKind = { Burn: 0, Poison: 1, Freeze: 2, Shock: 3, Bleed: 4 } as const;
export type DebuffKindValue = (typeof DebuffKind)[keyof typeof DebuffKind];

export const DebuffEventKind = { Applied: 0, Tick: 1, Consumed: 2, Triggered: 3 } as const;
export type DebuffEventKindValue = (typeof DebuffEventKind)[keyof typeof DebuffEventKind];

export interface DebuffEvent {
  source: number;
  target: number;
  debuff: DebuffKindValue;
  kind: DebuffEventKindValue;
  stacks: number;
  frames: number;
  damage: number;
}

/** What one `step()` produced. Read by the renderer and the lab; never by the simulation. */
export interface FrameReport {
  frame: number;
  contacts: ContactEvent[];
  debuffs: DebuffEvent[];
  moveStarts: { player: number; moveId: number }[];
  /** A fighter's state changed this frame, for the lab's state log. */
  stateChanges: { player: number; from: StateIdValue; to: StateIdValue }[];
}


// ---------------------------------------------------------------------------
// Simulation configuration
// ---------------------------------------------------------------------------

export interface SimConfig {
  /** Exactly two authored fighter definitions: player and Training dummy. */
  characters: readonly CharacterDef[];
  /** Exactly two starting ground origins in sim units. */
  startX: readonly number[];
  /** Seed for the deterministic RNG. */
  seed: number;
  /** Optional Training Grid presentation/bounds definition. */
  stage?: StageDef;
}

/** World-space collision volumes for one frame, for the debug overlay and for tests. */
export interface DebugBoxes {
  pushboxes: Aabb[];
  hurtboxes: Aabb[][];
  hitboxes: Aabb[][];
  origins: { x: number; y: number }[];
}
