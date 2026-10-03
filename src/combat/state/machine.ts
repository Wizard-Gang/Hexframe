/**
 * The fighter state machine: the questions the rest of the engine asks about a fighter,
 * and the two timers every state depends on.
 */

import type { FighterState, StateIdValue } from "../types";
import { StateId } from "../types";

/** True when the fighter is on the ground. */
export function isGrounded(f: FighterState): boolean {
  return f.airborne === 0;
}

/**
 * True when the fighter is free to act — to walk, to crouch, to start a move.
 *
 * Deliberately a question about state alone. Hitstop is a freeze applied on top of
 * whatever the fighter was doing, and the frame loop skips a frozen fighter's turn
 * outright rather than making every caller remember to ask about it here.
 */
export function isActionable(f: FighterState): boolean {
  return (
    f.state === StateId.Idle ||
    f.state === StateId.WalkForward ||
    f.state === StateId.WalkBackward ||
    f.state === StateId.Crouch
  );
}

/**
 * True when the fighter's stance is low — which decides both its hurtbox set and whether
 * it can guard a low attack. Blockstun and hitstun keep the stance they were entered in,
 * so a crouching fighter that blocks a low is still crouching for the next one.
 */
export function isCrouching(f: FighterState): boolean {
  return (
    f.state === StateId.Crouch ||
    f.state === StateId.HitstunCrouch ||
    f.state === StateId.BlockstunCrouch
  );
}

/** True in any hitstun or blockstun state. */
export function isInStun(f: FighterState): boolean {
  return (
    f.state === StateId.HitstunStand ||
    f.state === StateId.HitstunCrouch ||
    f.state === StateId.HitstunAir ||
    f.state === StateId.BlockstunStand ||
    f.state === StateId.BlockstunCrouch
  );
}

/** True in hitstun specifically — a fighter who is being hit, not one who is guarding. */
export function isInHitstun(f: FighterState): boolean {
  return (
    f.state === StateId.HitstunStand ||
    f.state === StateId.HitstunCrouch ||
    f.state === StateId.HitstunAir
  );
}

/**
 * Move to a state, resetting the frame counter, and report the state left behind.
 *
 * Re-entering the state a fighter is already in does nothing and returns `null`. Without
 * that, a fighter holding forward would reset `stateFrame` every frame and no state could
 * ever measure its own age — which is how walking, landing and jump squat all know when
 * they are done.
 */
export function enterState(f: FighterState, s: StateIdValue): StateIdValue | null {
  if (f.state === s) return null;
  const previous = f.state;
  f.state = s;
  f.stateFrame = 0;
  return previous;
}

/** The hitstun state suited to how the fighter is currently standing. */
export function hitstunStateFor(f: FighterState): StateIdValue {
  if (f.airborne === 1) return StateId.HitstunAir;
  return isCrouching(f) ? StateId.HitstunCrouch : StateId.HitstunStand;
}

/** The blockstun state suited to how the fighter is currently standing. */
export function blockstunStateFor(f: FighterState): StateIdValue {
  return isCrouching(f) ? StateId.BlockstunCrouch : StateId.BlockstunStand;
}

/**
 * Advance the fighter's timers by one frame.
 *
 * Hitstop first, and alone: while a fighter is frozen nothing else about it moves, which
 * is the entire point of hitstop — both fighters hang on the frame of contact for a
 * moment, and the defender's stun does not start burning down during it. Only once the
 * freeze is over does stun tick.
 */
export function tickTimers(f: FighterState): void {
  if (f.hitstop > 0) {
    f.hitstop--;
    return;
  }
  if (f.stun > 0) f.stun--;
}
