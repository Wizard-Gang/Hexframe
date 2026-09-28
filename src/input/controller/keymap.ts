import { InputBit } from "../../combat/types";

export interface KeyMap {
  [code: string]: number;
}

/** Physical action key → one of the four fixed kit positions. */
export interface ActionKeyMap {
  [code: string]: 0 | 1 | 2 | 3;
}

export const DEFAULT_KEYMAP_P1: KeyMap = {
  KeyW: InputBit.Up,
  KeyA: InputBit.Left,
  KeyS: InputBit.Down,
  KeyD: InputBit.Right,
};

export const DEFAULT_KEYMAP_P2: KeyMap = {
  KeyI: InputBit.Up,
  KeyJ: InputBit.Left,
  KeyK: InputBit.Down,
  KeyL: InputBit.Right,
};

/** Arrow diamond mirrors the standard gamepad Y / X / B / A face-button diamond. */
export const DEFAULT_ACTION_KEYMAP: ActionKeyMap = {
  ArrowUp: 0,
  ArrowLeft: 1,
  ArrowRight: 2,
  ArrowDown: 3,
};

export const NO_ACTION_KEYMAP: ActionKeyMap = {};
