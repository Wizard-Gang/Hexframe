import type { Facing, InputFrame } from "../../combat/types";
import { InputBit } from "../../combat/types";

/** 1 forward, -1 backward, 0 neither. Opposed horizontal inputs cancel. */
function horizontalOf(input: InputFrame, facing: Facing): number {
  const left = (input & InputBit.Left) !== 0;
  const right = (input & InputBit.Right) !== 0;
  if (left === right) return 0;
  const towardIncreasingX = right ? 1 : -1;
  return facing === 1 ? towardIncreasingX : -towardIncreasingX;
}

/** True when the fighter is holding toward the direction it faces. */
export function isForward(input: InputFrame, facing: Facing): boolean {
  return horizontalOf(input, facing) === 1;
}

/** True when the fighter is holding away from the direction it faces. */
export function isBackward(input: InputFrame, facing: Facing): boolean {
  return horizontalOf(input, facing) === -1;
}
