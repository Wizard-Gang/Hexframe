/**
 * Resolves the newest buffered button press that satisfies a command's stance.
 *
 * Commands are deliberately small: a button plus optional crouch/air requirements.
 * Directional motion recognition is not part of the command contract.
 */

import type { CharacterDef, CommandDef, FighterState, SimState } from "../../combat/types";
import { INPUT_BUFFER_FRAMES, NO_MOVE } from "../../combat/constants";
import { isCrouching } from "../../combat/state/machine";
import { pressedOn } from "../buffer/history";

/** The move id requested on the current frame, or `NO_MOVE`. */
export function resolveCommand(
  state: SimState,
  player: number,
  c: CharacterDef,
  f: FighterState,
): number {
  let best: CommandDef | null = null;
  for (const cmd of c.commands) {
    if (best !== null && cmd.priority <= best.priority) continue;
    if (matchedPressFrame(state, player, f, cmd) < 0) continue;
    best = cmd;
  }
  return best === null ? NO_MOVE : best.moveId;
}

/** The buffered press frame matched for `moveId`, or `-1`. */
export function commandPressFrame(
  state: SimState,
  player: number,
  c: CharacterDef,
  f: FighterState,
  moveId: number,
): number {
  let best: CommandDef | null = null;
  let bestFrame = -1;
  for (const cmd of c.commands) {
    if (cmd.moveId !== moveId) continue;
    if (best !== null && cmd.priority <= best.priority) continue;
    const frame = matchedPressFrame(state, player, f, cmd);
    if (frame < 0) continue;
    best = cmd;
    bestFrame = frame;
  }
  return bestFrame;
}

/** The newest eligible press in the input buffer, or `-1`. */
function matchedPressFrame(
  state: SimState,
  player: number,
  f: FighterState,
  cmd: CommandDef,
): number {
  if (cmd.requiresCrouch && !isCrouching(f)) return -1;
  if (cmd.requiresAir && f.airborne !== 1) return -1;

  const oldest = Math.max(
    state.frame - INPUT_BUFFER_FRAMES + 1,
    f.bufferConsumedFrame + 1,
    0,
  );
  for (let frame = state.frame; frame >= oldest; frame--) {
    if (pressedOn(state, player, frame, cmd.buttons)) return frame;
  }
  return -1;
}
