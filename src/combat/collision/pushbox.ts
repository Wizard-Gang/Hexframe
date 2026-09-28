/**
 * Keeping fighters out of each other, and inside the stage.
 */

import type { CharacterDef, FighterState, SimState } from "../types";
import { STAGE_HALF_WIDTH } from "../constants";
import { overlaps } from "./aabb";
import { pushboxOf } from "./boxes";

/**
 * Slide a fighter back inside the stage if its pushbox has left it.
 *
 * The fighter's *origin* moves by however far its box overshot, so a fighter with an
 * off-centre pushbox stops at the wall where its box says it should rather than where its
 * origin does.
 */
export function clampToStage(
  f: FighterState,
  c: CharacterDef,
  minX = -STAGE_HALF_WIDTH,
  maxX = STAGE_HALF_WIDTH,
): void {
  const box = pushboxOf(f, c);
  if (box.x0 < minX) {
    f.x += minX - box.x0;
  } else if (box.x1 > maxX) {
    f.x -= box.x1 - maxX;
  }
}

/** True when the fighter is standing against a wall, within a hundredth of a pixel. */
function atWall(f: FighterState, c: CharacterDef, minX: number, maxX: number): boolean {
  const box = pushboxOf(f, c);
  return box.x0 <= minX || box.x1 >= maxX;
}

/**
 * Separate overlapping fighters, then hold them inside the stage.
 *
 * Each fighter gives up half the overlap. An odd overlap cannot be split evenly in
 * integers, so the extra unit always goes to the fighter on the right — an arbitrary
 * choice, but a fixed one, and a fixed arbitrary choice is exactly what determinism needs.
 * When two fighters occupy the same x the tie is broken by player index for the same
 * reason: the result must never depend on which one the loop happened to reach first.
 *
 * The wall is resolved second and wins. If clamping pushes a cornered fighter back into
 * its opponent, the opponent absorbs the whole remaining overlap instead — a fighter in
 * the corner is not squeezed through the wall, which is the behaviour that makes corner
 * pressure mean anything.
 */
export function resolvePushboxes(state: SimState, chars: readonly CharacterDef[]): void {
  const a = state.fighters[0];
  const b = state.fighters[1];
  const charA = chars[0];
  const charB = chars[1];
  const minX = state.stage.worldMinX;
  const maxX = state.stage.worldMaxX;

  separatePair(a, charA, 0, b, charB, 1);
  clampToStage(a, charA, minX, maxX);
  clampToStage(b, charB, minX, maxX);
  separatePairAtWalls(a, charA, b, charB, minX, maxX);
}

function separatePair(
  a: FighterState,
  charA: CharacterDef,
  indexA: number,
  b: FighterState,
  charB: CharacterDef,
  indexB: number,
): void {
  const boxA = pushboxOf(a, charA);
  const boxB = pushboxOf(b, charB);
  if (!overlaps(boxA, boxB)) return;
  const overlapX = Math.min(boxA.x1, boxB.x1) - Math.max(boxA.x0, boxB.x0);
  const aIsLeft = a.x < b.x || (a.x === b.x && indexA < indexB);
  const left = aIsLeft ? a : b;
  const right = aIsLeft ? b : a;
  const half = Math.trunc(overlapX / 2);
  left.x -= half;
  right.x += overlapX - half;
}

function separatePairAtWalls(
  a: FighterState,
  charA: CharacterDef,
  b: FighterState,
  charB: CharacterDef,
  minX: number,
  maxX: number,
): void {
  const boxA = pushboxOf(a, charA);
  const boxB = pushboxOf(b, charB);
  if (!overlaps(boxA, boxB)) return;
  const overlapX = Math.min(boxA.x1, boxB.x1) - Math.max(boxA.x0, boxB.x0);
  const aAtWall = atWall(a, charA, minX, maxX);
  const bAtWall = atWall(b, charB, minX, maxX);
  if (aAtWall && !bAtWall) b.x += a.x <= b.x ? overlapX : -overlapX;
  else if (!aAtWall) a.x += b.x <= a.x ? overlapX : -overlapX;
}
