/**
 * Which volumes a fighter presents this frame.
 *
 * Everything here derives from simulation state and character data alone. Nothing reads
 * the renderer, and nothing reads an animation — a box is where the move data says it is,
 * not where the drawing happens to have put an arm.
 */

import type {
  Aabb,
  Box,
  CharacterDef,
  DebugBoxes,
  FighterState,
  HitboxSpec,
  InvulKindValue,
  MoveDef,
  SimState,
} from "../types";
import { InvulKind, StateId } from "../types";
import { NO_MOVE } from "../constants";
import { boxToWorld } from "./aabb";
import { isCrouching } from "../state/machine";
import { moveOf } from "../commands/resolve";

/** The move the fighter is performing, or `null`. */
export function activeMoveOf(f: FighterState, c: CharacterDef): MoveDef | null {
  if (f.moveId === NO_MOVE) return null;
  return moveOf(c, f.moveId);
}

/** The default volume set for the fighter's stance, before any move override. */
function stanceHurtboxes(f: FighterState, c: CharacterDef): Box[] {
  if (f.airborne === 1) return c.hurtboxesAir;
  return isCrouching(f) ? c.hurtboxesCrouch : c.hurtboxesStand;
}

/** The space the fighter occupies, which no other fighter may stand inside. */
export function pushboxOf(f: FighterState, c: CharacterDef): Aabb {
  const box =
    f.airborne === 1 ? c.pushboxAir : isCrouching(f) ? c.pushboxCrouch : c.pushboxStand;
  return boxToWorld(box, f.x, f.y, f.facing);
}

/**
 * Where the fighter can be hit.
 *
 * A move's hurtbox window **replaces** the stance's boxes rather than adding to them, so
 * an extended limb is authored as the whole vulnerable silhouette for those frames. Adding
 * would make it impossible to author a move that makes a fighter smaller, which is most of
 * what hurtbox windows are for.
 */
export function hurtboxesOf(f: FighterState, c: CharacterDef): Aabb[] {
  const move = activeMoveOf(f, c);
  if (move !== null) {
    for (const w of move.hurtboxWindows) {
      if (f.moveFrame >= w.startFrame && f.moveFrame <= w.endFrame) {
        return w.boxes.map((b) => boxToWorld(b, f.x, f.y, f.facing));
      }
    }
  }
  return stanceHurtboxes(f, c).map((b) => boxToWorld(b, f.x, f.y, f.facing));
}

/**
 * The attack boxes live on this frame of the fighter's move, with the data behind each.
 *
 * Hitstop is not consulted. It freezes `moveFrame`, so a frozen attacker keeps presenting
 * exactly the boxes it presented on the frame of contact; what stops it hitting again is
 * the `hitFlags` gate in hit resolution, not the absence of a box. Keeping the box present
 * is also what lets the debug overlay show the player the box that actually connected,
 * held on screen for the duration of the freeze.
 */
export function activeHitboxesOf(
  f: FighterState,
  c: CharacterDef,
): { spec: HitboxSpec; aabb: Aabb }[] {
  const move = activeMoveOf(f, c);
  if (move === null) return [];
  const out: { spec: HitboxSpec; aabb: Aabb }[] = [];
  for (const spec of move.hitboxes) {
    if (f.moveFrame < spec.startFrame || f.moveFrame > spec.endFrame) continue;
    out.push({ spec, aabb: boxToWorld(spec.box, f.x, f.y, f.facing) });
  }
  return out;
}

/**
 * True when a move is currently making the fighter immune to `kind`.
 *
 * A `Full` window covers everything; a `Strike` or `Throw` window covers only its own kind.
 * No move in 0.1 has one — the uppercut is where this earns its keep — but hit resolution
 * asks the question already so that adding the move is data rather than an engine change.
 */
export function isInvulnerable(
  f: FighterState,
  c: CharacterDef,
  kind: InvulKindValue,
): boolean {
  const move = activeMoveOf(f, c);
  if (move === null) return false;
  for (const w of move.invulWindows) {
    if (f.moveFrame < w.startFrame || f.moveFrame > w.endFrame) continue;
    if (w.kind === InvulKind.Full || w.kind === kind) return true;
  }
  return false;
}

/** Remaining strike armor on the current move frame. */
export function armorRemaining(f: FighterState, c: CharacterDef): number {
  const move = activeMoveOf(f, c);
  if (move === null) return 0;
  for (const window of move.armorWindows) {
    if (f.moveFrame < window.startFrame || f.moveFrame > window.endFrame) continue;
    return Math.max(0, window.hits - f.armorHits);
  }
  return 0;
}

/** Every volume in the match this frame, in player order, for the overlay and for tests. */
export function debugBoxes(state: SimState, chars: readonly CharacterDef[]): DebugBoxes {
  const pushboxes: Aabb[] = [];
  const hurtboxes: Aabb[][] = [];
  const hitboxes: Aabb[][] = [];
  const origins: { x: number; y: number }[] = [];
  for (let p = 0; p < state.fighters.length; p++) {
    const f = state.fighters[p];
    const c = chars[p];
    pushboxes.push(pushboxOf(f, c));
    hurtboxes.push(hurtboxesOf(f, c));
    hitboxes.push(activeHitboxesOf(f, c).map((h) => h.aabb));
    origins.push({ x: f.x, y: f.y });
  }
  return { pushboxes, hurtboxes, hitboxes, origins };
}
