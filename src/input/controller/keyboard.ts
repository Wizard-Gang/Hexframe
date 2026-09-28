/**
 * Browser keyboard input adapter. Modified action arrows are intentionally left to the
 * browser/page; the fixed kit owns only unmodified ArrowUp/Left/Right/Down presses.
 */
import type { InputFrame } from "../../combat/types";
import { actionBit, INPUT_MASK } from "../../combat/types";
import type { ActionKeyMap, KeyMap } from "./keymap";

export class KeyboardController {
  private readonly target: EventTarget;
  private readonly map: KeyMap;
  private readonly actionMap: ActionKeyMap;
  private readonly mapped: Set<string>;
  private readonly held = new Set<string>();
  private readonly pressed = new Set<string>();
  private readonly heldActions = new Map<string, number>();
  private pressedActionBits = 0;
  private disposed = false;

  private readonly onKeyDown = (ev: Event): void => {
    const e = ev as KeyboardEvent;
    if (!this.captures(e)) return;
    const position = this.actionMap[e.code];
    if (position !== undefined) {
      const bit = actionBit(position);
      this.heldActions.set(e.code, bit);
      this.pressedActionBits |= bit;
    } else {
      this.held.add(e.code);
      this.pressed.add(e.code);
    }
    e.preventDefault();
  };

  private readonly onKeyUp = (ev: Event): void => {
    const e = ev as KeyboardEvent;
    const wasHeld = this.held.has(e.code) || this.heldActions.has(e.code);
    if (!this.captures(e) && !wasHeld) return;
    this.held.delete(e.code);
    this.heldActions.delete(e.code);
    if (wasHeld || this.captures(e)) e.preventDefault();
  };

  private readonly onBlur = (): void => {
    this.held.clear();
    this.pressed.clear();
    this.heldActions.clear();
    this.pressedActionBits = 0;
  };

  constructor(target: EventTarget, map: KeyMap, actionMap: ActionKeyMap = {}) {
    this.target = target;
    this.map = map;
    this.actionMap = actionMap;
    this.mapped = new Set([...Object.keys(map), ...Object.keys(actionMap)]);
    target.addEventListener("keydown", this.onKeyDown);
    target.addEventListener("keyup", this.onKeyUp);
    target.addEventListener("blur", this.onBlur);
  }

  sample(): InputFrame {
    let bits = this.pressedActionBits;
    const active = new Set([...this.held, ...this.pressed]);
    for (const code of active) bits |= this.map[code] ?? 0;
    for (const bit of this.heldActions.values()) bits |= bit;
    this.pressed.clear();
    this.pressedActionBits = 0;
    return bits & INPUT_MASK;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.target.removeEventListener("keydown", this.onKeyDown);
    this.target.removeEventListener("keyup", this.onKeyUp);
    this.target.removeEventListener("blur", this.onBlur);
    this.held.clear();
    this.pressed.clear();
    this.heldActions.clear();
    this.pressedActionBits = 0;
  }

  private captures(e: KeyboardEvent): boolean {
    if (e.altKey) return false;
    const target = e.target;
    if (
      typeof Element !== "undefined" && target instanceof Element &&
      target.closest("button, a, input, select, textarea, [contenteditable='true']")
    ) {
      return false;
    }
    if (!this.mapped.has(e.code)) return false;
    if (Object.prototype.hasOwnProperty.call(this.actionMap, e.code) && (e.shiftKey || e.ctrlKey || e.metaKey)) {
      return false;
    }
    if (e.ctrlKey || e.metaKey) return false;
    return true;
  }
}
