/**
 * Starting, advancing and ending a move.
 *
 * The parser decides what the player asked for; this decides whether they may have it and
 * what happens to the fighter while they do.
 */

import type { CharacterDef, FighterState, MoveDef } from "../types";
import { StateId } from "../types";
import { NO_MOVE } from "../constants";
import { enterState, isActionable, isCrouching } from "../state/machine";

/** The move with this id, or `null`. */
export function moveOf(c: CharacterDef, moveId: number): MoveDef | null {
  if (moveId === NO_MOVE) return null;
  for (const m of c.moves) {
    if (m.id === moveId) return m;
  }
  return null;
}

/**
 * Whether the fighter may start this move right now.
 *
 * Two ways in. A free fighter may start anything its stance allows. A fighter already
 * committed to a move may only start one its current move explicitly cancels into, which
 * is the whole of the combo system: everything a player can chain is authored in the move
 * data, and nothing is chainable by accident.
 *
 * The airborne clause admits a fighter in free flight as well as an actionable one,
 * because `isActionable` is a question about grounded states. No 0.1 move sets `airOk`, so
 * this changes nothing yet — it is here so that the jumping light is content rather than
 * an engine change.
 */
export function canStartMove(f: FighterState, c: CharacterDef, m: MoveDef): boolean {
  if (f.hitstop > 0) return false;
  if (m.airOk && f.airborne === 0) return false;
  if (!m.airOk && f.airborne === 1) return false;
  if (m.requiresCrouch && !isCrouching(f)) return false;

  const free = isActionable(f) || (f.airborne === 1 && f.state === StateId.Airborne);
  if (free) return true;
  if (f.state === StateId.Dash) {
    const profile = f.dashForward === 1 ? c.dashForward : c.dashBackward;
    return f.stateFrame >= profile.attackCancelFrame;
  }
  return cancelAllowed(f, c, m.id);
}

/**
 * Put the fighter into a move on its own frame 0.
 *
 * `hitFlags` records which hitboxes connected with the sole opposing fighter and is also
 * the aggregate signal used by on-hit cancels. It belongs to the move attempt and clears
 * when that attempt starts or ends.
 */
export function startMove(f: FighterState, c: CharacterDef, m: MoveDef): void {
  f.moveId = m.id;
  f.moveFrame = 0;
  clearHitFlags(f);
  f.armorHits = 0;
  enterState(f, StateId.Attack);
  applyMovementKeys(f, m, 0);
}

/**
 * Advance the fighter one frame through its move, ending it at `duration`.
 *
 * Called only for a move that did not start this frame: a move that starts on frame N is
 * *on* frame 0 during frame N, and advancing it immediately would silently shave a frame
 * off every startup in the game.
 */
export function advanceMove(f: FighterState, c: CharacterDef): void {
  const m = moveOf(c, f.moveId);
  if (m === null) {
    f.moveId = NO_MOVE;
    f.moveFrame = 0;
    return;
  }
  f.moveFrame++;
  if (f.moveFrame >= m.duration) {
    endMove(f, m);
    return;
  }
  applyMovementKeys(f, m, f.moveFrame);
}

/**
 * Return the fighter to a neutral state after a move.
 *
 * A crouching move ends crouching. Standing up at the end of every low would mean a player
 * holding down was briefly standing, and briefly standing is enough to be hit by something
 * they were guarding against.
 */
export function endMove(f: FighterState, m: MoveDef): void {
  f.moveId = NO_MOVE;
  f.moveFrame = 0;
  clearHitFlags(f);
  f.armorHits = 0;
  enterState(
    f,
    f.airborne === 1 ? StateId.Airborne : m.requiresCrouch ? StateId.Crouch : StateId.Idle,
  );
}

/** Whether the fighter's current move may be cancelled into `intoMoveId` on this frame. */
export function cancelAllowed(f: FighterState, c: CharacterDef, intoMoveId: number): boolean {
  const m = moveOf(c, f.moveId);
  if (m === null) return false;
  for (const w of m.cancelWindows) {
    if (f.moveFrame < w.startFrame || f.moveFrame > w.endFrame) continue;
    if (!w.into.includes(intoMoveId)) continue;
    // `hitFlags` is non-zero exactly when something of this move has connected, which is
    // what "on hit" means for a cancel — including when the opponent blocked it.
    if (w.onHitOnly && f.hitFlags === 0) continue;
    return true;
  }
  return false;
}

/**
 * Apply any velocity change the move schedules for this frame.
 *
 * `vx` is authored along the fighter's facing and mirrored here, so a move that lunges
 * forward lunges forward in both directions. An upward `vy` also lifts the fighter off the
 * ground, so that a launching move does not need a separate flag to say it leaves it.
 */
function applyMovementKeys(f: FighterState, m: MoveDef, frame: number): void {
  for (const k of m.movement) {
    if (k.frame !== frame) continue;
    f.vx = k.vx * f.facing;
    f.vy = k.vy;
    if (k.vy > 0) f.airborne = 1;
  }
}

function clearHitFlags(f: FighterState): void {
  f.hitFlags = 0;
}
