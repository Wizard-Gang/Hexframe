/**
 * The combat core's public surface. Everything outside `src/combat` imports from here
 * rather than reaching into subdirectories, so the boundary is visible in the import.
 */
export * from "./types";
export * from "./constants";
export { Simulation } from "./simulation/simulation";
export { overlaps, intersection, boxToWorld, centerOf } from "./collision/aabb";
export {
  activeMoveOf,
  pushboxOf,
  hurtboxesOf,
  activeHitboxesOf,
  isInvulnerable,
  debugBoxes,
} from "./collision/boxes";
export { resolvePushboxes, clampToStage } from "./collision/pushbox";
export {
  isGrounded,
  isActionable,
  isCrouching,
  isInStun,
  enterState,
  hitstunStateFor,
  blockstunStateFor,
  tickTimers,
} from "./state/machine";
export { applyMovement, applyGroundMotion } from "./movement/physics";
export { moveOf, canStartMove, startMove, advanceMove, cancelAllowed } from "./commands/resolve";
export { resolveContacts, isBlocking } from "./hit-resolution/resolve";
