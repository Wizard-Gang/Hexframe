/**
 * Movement: what the player asks for on the ground, and how the world answers.
 *
 * Integer arithmetic throughout, in sim units per frame. There is no acceleration curve
 * and no drag coefficient — velocities are set outright and gravity is a constant
 * subtraction, because a fighting game wants movement a player can predict to the frame
 * and a rollback wants arithmetic that cannot drift.
 */

import type { CharacterDef, FighterState, InputFrame } from "../types";
import { InputBit, StateId } from "../types";
import { GROUND_Y } from "../constants";
import { enterState, isActionable, isInHitstun, isInStun } from "../state/machine";
import { isBackward, isForward } from "../../input/parser/numpad";

/**
 * Translate this frame's held direction into a stance and a walking velocity.
 *
 * Only a grounded, actionable fighter listens. Everyone else — mid-move, in stun, in jump
 * squat, landing — keeps whatever velocity was given to them, which is what makes
 * pushback and recovery frames feel like consequences rather than suggestions.
 *
 * Down beats left and right: crouching is a stance, and a player holding down-back is
 * crouching, not walking backwards. Up starts a jump squat rather than leaving the ground
 * immediately; the direction that jump carries is read later, at the moment of launch,
 * from the input that was held when the squat began.
 */
export function applyGroundMotion(f: FighterState, c: CharacterDef, input: InputFrame): void {
  if (f.airborne === 1) return;
  if (!isActionable(f)) return;

  if ((input & InputBit.Up) !== 0) {
    enterState(f, StateId.JumpSquat);
    f.vx = 0;
    return;
  }

  if ((input & InputBit.Down) !== 0) {
    enterState(f, StateId.Crouch);
    f.vx = 0;
    return;
  }

  if (isForward(input, f.facing)) {
    enterState(f, StateId.WalkForward);
    f.vx = c.walkForwardSpeed * f.facing;
  } else if (isBackward(input, f.facing)) {
    enterState(f, StateId.WalkBackward);
    f.vx = -c.walkBackwardSpeed * f.facing;
  } else {
    enterState(f, StateId.Idle);
    f.vx = 0;
  }
}

/**
 * Integrate one frame of physics.
 *
 * Position first, then gravity, so a fighter's first airborne frame travels at its full
 * launch velocity rather than at an already-decayed one — the alternative loses a frame of
 * jump height and makes authored jump arcs disagree with the numbers they were authored
 * from.
 *
 * Ground friction only bites a fighter who is not walking. Its purpose is to bleed off
 * pushback, so that being hit or blocking slides a fighter and then settles them, rather
 * than leaving them drifting for the rest of the round.
 */
export function applyMovement(f: FighterState, c: CharacterDef): void {
  f.x += f.vx;
  f.y += f.vy;

  if (f.airborne === 1) {
    f.vy -= c.gravity;
  }

  if (f.y <= GROUND_Y) {
    const wasAirborne = f.airborne === 1;
    f.y = GROUND_Y;
    f.vy = 0;
    f.airborne = 0;
    if (wasAirborne) {
      // A fighter still in hitstun when it lands keeps the stun it has left and simply
      // becomes a grounded version of it. Landing recovery is for a fighter who chose to
      // jump; being knocked out of the air and then owing landing frames on top would
      // punish the same hit twice.
      if (isInHitstun(f)) {
        enterState(f, StateId.HitstunStand);
      } else if (!isInStun(f) && f.state !== StateId.Attack) {
        enterState(f, StateId.Landing);
      }
    }
  }

  const walking = f.state === StateId.WalkForward || f.state === StateId.WalkBackward;
  if (f.airborne === 0 && !walking && f.vx !== 0) {
    const decay = c.groundFriction;
    if (Math.abs(f.vx) <= decay) f.vx = 0;
    else f.vx -= Math.sign(f.vx) * decay;
  }
}
