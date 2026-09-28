/**
 * The byte layout of a simulation state, and the only definition of it.
 *
 * Everything that has to agree about "the state" agrees here: the determinism hash
 * hashes these bytes, the snapshot ring stores these bytes, and a future network peer
 * will send these bytes. That is why the layout is spelled out explicitly rather than
 * derived from a generic walk of the object — a generic walk would silently change shape
 * the day someone reorders a field, and the first symptom would be a desync in a match.
 *
 * Two rules make the encoding portable. Every multi-byte write passes `true` for
 * `littleEndian` so the result never depends on the machine, and every field is written
 * as a signed 32-bit integer, because signed int32 is the widest form that round-trips
 * every value the simulation can hold — positions and velocities go negative constantly
 * and an unsigned write would fold them onto a different bit pattern on the way back.
 * `rng` is the one exception and is documented where it is written.
 *
 * Field order is exactly declaration order in `src/combat/types.ts`. The fighter count is
 * fixed at two; variable-length input-history rows remain length-prefixed.
 */

import { PLAYER_COUNT, SNAPSHOT_VERSION } from "../../combat/constants";
import { StateId } from "../../combat/types";
import type { Facing, FighterState, SimState, StateIdValue } from "../../combat/types";

/** version, frame, rng. Fighter count is fixed by the Training simulation contract. */
const HEADER_INTS = 3;

/** `FighterState` has thirty integer fields. */
const FIGHTER_INTS = 30;

/** Training keeps only immutable-grid world bounds in state. */
const STAGE_INTS = 2;

const BYTES_PER_INT = 4;

class ByteWriter {
  private readonly view: DataView;
  private offset = 0;

  constructor(target: Uint8Array) {
    // The byteOffset and byteLength matter: a Uint8Array handed to us may be a view into
    // a larger buffer, and a DataView built from `.buffer` alone would write past it.
    this.view = new DataView(target.buffer, target.byteOffset, target.byteLength);
  }

  i32(value: number): void {
    this.view.setInt32(this.offset, value, true);
    this.offset += BYTES_PER_INT;
  }

  u32(value: number): void {
    this.view.setUint32(this.offset, value, true);
    this.offset += BYTES_PER_INT;
  }
}

class ByteReader {
  private readonly view: DataView;
  private offset = 0;

  constructor(source: Uint8Array) {
    this.view = new DataView(source.buffer, source.byteOffset, source.byteLength);
  }

  i32(): number {
    const value = this.view.getInt32(this.offset, true);
    this.offset += BYTES_PER_INT;
    return value;
  }

  u32(): number {
    const value = this.view.getUint32(this.offset, true);
    this.offset += BYTES_PER_INT;
    return value;
  }

  /** Array lengths are the one place a corrupt buffer could ask for a huge allocation. */
  count(what: string): number {
    const value = this.i32();
    if (value < 0) {
      throw new RangeError(`snapshot: negative ${what} count ${value}`);
    }
    return value;
  }
}

const STATE_IDS: ReadonlySet<number> = new Set<number>(Object.values(StateId));

function toFacing(value: number): Facing {
  if (value === 1) return 1;
  if (value === -1) return -1;
  throw new RangeError(`snapshot: facing must be 1 or -1, got ${value}`);
}

function toStateId(value: number): StateIdValue {
  if (!STATE_IDS.has(value)) {
    throw new RangeError(`snapshot: unknown state id ${value}`);
  }
  return value as StateIdValue;
}

function byteLengthOf(state: SimState): number {
  if (state.fighters.length !== PLAYER_COUNT) {
    throw new RangeError(`snapshot: expected ${PLAYER_COUNT} fighters, got ${state.fighters.length}`);
  }
  if (state.inputHistory.length !== PLAYER_COUNT) {
    throw new RangeError(`snapshot: expected ${PLAYER_COUNT} input histories, got ${state.inputHistory.length}`);
  }
  let ints = HEADER_INTS + PLAYER_COUNT * FIGHTER_INTS;
  ints += STAGE_INTS;
  ints += 1; // roundOver
  ints += 1; // player count for the input history
  for (const row of state.inputHistory) {
    ints += 1 + row.length;
  }
  return ints * BYTES_PER_INT;
}

export function serializeState(state: SimState): Uint8Array {
  const bytes = new Uint8Array(byteLengthOf(state));
  const w = new ByteWriter(bytes);

  w.i32(SNAPSHOT_VERSION);
  w.i32(state.frame);
  // The RNG word is the one unsigned field. It is a bit pattern rather than a quantity —
  // xorshift only ever shifts and xors it — so writing it unsigned keeps the stored form
  // canonical whichever sign convention the generator happens to leave it in.
  w.u32(state.rng >>> 0);

  for (const f of state.fighters) {
    w.i32(f.x);
    w.i32(f.y);
    w.i32(f.vx);
    w.i32(f.vy);
    w.i32(f.facing);
    w.i32(f.state);
    w.i32(f.stateFrame);
    w.i32(f.moveId);
    w.i32(f.moveFrame);
    w.i32(f.hitstop);
    w.i32(f.stun);
    w.i32(f.health);
    w.i32(f.stamina);
    w.i32(f.staminaRegenDelay);
    w.i32(f.airborne);
    w.i32(f.hitFlags);
    w.i32(f.comboCount);
    w.i32(f.armorHits);
    w.i32(f.bufferConsumedFrame);
    w.i32(f.dashForward);
    w.i32(f.burnStacks);
    w.i32(f.burnFrames);
    w.i32(f.poisonStacks);
    w.i32(f.poisonFrames);
    w.i32(f.freezeStacks);
    w.i32(f.freezeFrames);
    w.i32(f.shockStacks);
    w.i32(f.shockFrames);
    w.i32(f.bleedStacks);
    w.i32(f.bleedFrames);
  }

  w.i32(state.stage.worldMinX);
  w.i32(state.stage.worldMaxX);

  w.i32(state.roundOver);

  w.i32(state.inputHistory.length);
  for (const row of state.inputHistory) {
    w.i32(row.length);
    for (const input of row) {
      w.i32(input);
    }
  }

  return bytes;
}

export function deserializeState(bytes: Uint8Array): SimState {
  const r = new ByteReader(bytes);

  const version = r.i32();
  if (version !== SNAPSHOT_VERSION) {
    // Refusing an unknown version is the whole point of writing one. A reader that
    // guessed would produce a state that looks plausible and hashes differently, which
    // is the hardest class of bug this project can have.
    throw new RangeError(
      `snapshot: version ${version} cannot be read by version ${SNAPSHOT_VERSION}`,
    );
  }

  const frame = r.i32();
  const rng = r.u32();

  const fighters: FighterState[] = new Array<FighterState>(PLAYER_COUNT);
  for (let i = 0; i < PLAYER_COUNT; i++) {
    fighters[i] = {
      x: r.i32(),
      y: r.i32(),
      vx: r.i32(),
      vy: r.i32(),
      facing: toFacing(r.i32()),
      state: toStateId(r.i32()),
      stateFrame: r.i32(),
      moveId: r.i32(),
      moveFrame: r.i32(),
      hitstop: r.i32(),
      stun: r.i32(),
      health: r.i32(),
      stamina: r.i32(),
      staminaRegenDelay: r.i32(),
      airborne: r.i32(),
      hitFlags: r.i32(),
      comboCount: r.i32(),
      armorHits: r.i32(),
      bufferConsumedFrame: r.i32(),
      dashForward: r.i32(),
      burnStacks: r.i32(),
      burnFrames: r.i32(),
      poisonStacks: r.i32(),
      poisonFrames: r.i32(),
      freezeStacks: r.i32(),
      freezeFrames: r.i32(),
      shockStacks: r.i32(),
      shockFrames: r.i32(),
      bleedStacks: r.i32(),
      bleedFrames: r.i32(),
    };
  }

  const stage = {
    worldMinX: r.i32(),
    worldMaxX: r.i32(),
  };

  const roundOver = r.i32();

  const playerCount = r.count("input history player");
  if (playerCount !== PLAYER_COUNT) {
    throw new RangeError(`snapshot: expected ${PLAYER_COUNT} input histories, got ${playerCount}`);
  }
  const inputHistory: number[][] = new Array<number[]>(playerCount);
  for (let p = 0; p < playerCount; p++) {
    const rowLength = r.count("input history frame");
    const row: number[] = new Array<number>(rowLength);
    for (let i = 0; i < rowLength; i++) {
      row[i] = r.i32();
    }
    inputHistory[p] = row;
  }

  return { frame, rng, fighters, stage, roundOver, inputHistory };
}

/**
 * A field-by-field deep copy.
 *
 * Deliberately not `JSON.parse(JSON.stringify(state))`: that route is slow enough to show
 * up when the lab snapshots every frame, and it is lossy in ways that matter here — `-0`
 * comes back as `0`, and any numeric key would come back as a string. Writing the fields
 * out also means adding a field to `types.ts` without updating this file is a visible
 * omission rather than something a generic copier papers over.
 */
export function cloneState(state: SimState): SimState {
  const fighters: FighterState[] = new Array<FighterState>(state.fighters.length);
  for (let i = 0; i < state.fighters.length; i++) {
    const f = state.fighters[i];
    fighters[i] = {
      x: f.x,
      y: f.y,
      vx: f.vx,
      vy: f.vy,
      facing: f.facing,
      state: f.state,
      stateFrame: f.stateFrame,
      moveId: f.moveId,
      moveFrame: f.moveFrame,
      hitstop: f.hitstop,
      stun: f.stun,
      health: f.health,
      stamina: f.stamina,
      staminaRegenDelay: f.staminaRegenDelay,
      airborne: f.airborne,
      hitFlags: f.hitFlags,
      comboCount: f.comboCount,
      armorHits: f.armorHits,
      bufferConsumedFrame: f.bufferConsumedFrame,
      dashForward: f.dashForward,
      burnStacks: f.burnStacks,
      burnFrames: f.burnFrames,
      poisonStacks: f.poisonStacks,
      poisonFrames: f.poisonFrames,
      freezeStacks: f.freezeStacks,
      freezeFrames: f.freezeFrames,
      shockStacks: f.shockStacks,
      shockFrames: f.shockFrames,
      bleedStacks: f.bleedStacks,
      bleedFrames: f.bleedFrames,
    };
  }

  const inputHistory: number[][] = new Array<number[]>(state.inputHistory.length);
  for (let p = 0; p < state.inputHistory.length; p++) {
    inputHistory[p] = state.inputHistory[p].slice();
  }

  return {
    frame: state.frame,
    rng: state.rng,
    fighters,
    stage: { ...state.stage },
    roundOver: state.roundOver,
    inputHistory,
  };
}
