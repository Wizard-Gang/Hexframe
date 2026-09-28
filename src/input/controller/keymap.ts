/**
 * Physical keys to input bits.
 *
 * Keys are identified by `KeyboardEvent.code`, the physical position, and never by `key`.
 * `code` does not change with the layout or with a modifier, so an AZERTY player's left
 * hand lands on the same four keys as a QWERTY player's and shift does not silently
 * rebind anything.
 */

import { InputBit } from "../../combat/types";

/** `KeyboardEvent.code` → `InputBit`. Several codes may map to the same bit. */
export interface KeyMap {
  [code: string]: number;
}

/** Physical action key → one of four positions inside the active modifier bank. */
export interface ActionKeyMap {
  [code: string]: 0 | 1 | 2 | 3;
}

/** Movement stays on the left hand; action selection is handled by `DEFAULT_ACTION_KEYMAP`. */
export const DEFAULT_KEYMAP_P1: KeyMap = {
  KeyW: InputBit.Up,
  KeyA: InputBit.Left,
  KeyS: InputBit.Down,
  KeyD: InputBit.Right,
};

/** Optional second-player movement keys used by dummy recording. */
export const DEFAULT_KEYMAP_P2: KeyMap = {
  KeyI: InputBit.Up,
  KeyJ: InputBit.Left,
  KeyK: InputBit.Down,
  KeyL: InputBit.Right,
};

/** Spatial action diamond: keyboard arrows mirror Y/X/B/A on a standard gamepad. */
export const DEFAULT_ACTION_KEYMAP: ActionKeyMap = {
  ArrowUp: 0,
  ArrowLeft: 1,
  ArrowRight: 2,
  ArrowDown: 3,
};

export const NO_ACTION_KEYMAP: ActionKeyMap = {};
