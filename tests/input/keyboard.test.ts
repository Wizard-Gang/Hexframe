import { describe, expect, it } from "vitest";

import { InputBit } from "../../src/combat/types";
import { KeyboardController } from "../../src/input/controller/keyboard";
import { DEFAULT_ACTION_KEYMAP, DEFAULT_KEYMAP_P1 } from "../../src/input/controller/keymap";

function key(
  target: EventTarget,
  type: "keydown" | "keyup",
  code: string,
  modifiers: { ctrl?: boolean; meta?: boolean; shift?: boolean } = {},
): boolean {
  const event = new Event(type, { cancelable: true });
  Object.defineProperties(event, {
    code: { value: code },
    ctrlKey: { value: modifiers.ctrl ?? false },
    metaKey: { value: modifiers.meta ?? false },
    shiftKey: { value: modifiers.shift ?? false },
    altKey: { value: false },
  });
  return target.dispatchEvent(event);
}

describe("keyboard input adapter", () => {
  it("queues an ultra-fast action tap for exactly one sample", () => {
    const target = new EventTarget();
    const keyboard = new KeyboardController(target, DEFAULT_KEYMAP_P1, DEFAULT_ACTION_KEYMAP);
    key(target, "keydown", "ArrowUp");
    key(target, "keyup", "ArrowUp");

    expect(keyboard.sample()).toBe(InputBit.Action1);
    expect(keyboard.sample()).toBe(0);
    keyboard.dispose();
  });

  it("continues sampling a movement key while it is held", () => {
    const target = new EventTarget();
    const keyboard = new KeyboardController(target, DEFAULT_KEYMAP_P1, DEFAULT_ACTION_KEYMAP);
    key(target, "keydown", "KeyD");

    expect(keyboard.sample()).toBe(InputBit.Right);
    expect(keyboard.sample()).toBe(InputBit.Right);
    key(target, "keyup", "KeyD");
    expect(keyboard.sample()).toBe(0);
    keyboard.dispose();
  });

  it("reserves Space and uses Ctrl/Command for power", () => {
    const target = new EventTarget();
    const keyboard = new KeyboardController(target, DEFAULT_KEYMAP_P1, DEFAULT_ACTION_KEYMAP, { ownsModifiedActions: () => true });
    key(target, "keydown", "ArrowUp", { ctrl: true });
    expect(keyboard.sample()).toBe(InputBit.Action9);
    key(target, "keyup", "ArrowUp", { ctrl: true });
    key(target, "keydown", "Space");
    key(target, "keydown", "ArrowUp");
    expect(keyboard.sample()).toBe(InputBit.Action1);
    keyboard.dispose();
  });

  it("only consumes Command plus mapped arrows while the play surface owns focus", () => {
    const target = new EventTarget();
    let ownsFocus = false;
    const keyboard = new KeyboardController(target, DEFAULT_KEYMAP_P1, DEFAULT_ACTION_KEYMAP, { ownsModifiedActions: () => ownsFocus });
    expect(key(target, "keydown", "ArrowUp", { meta: true })).toBe(true);
    expect(keyboard.sample()).toBe(0);
    ownsFocus = true;
    expect(key(target, "keydown", "ArrowUp", { meta: true })).toBe(false);
    expect(keyboard.sample()).toBe(InputBit.Action9);
    expect(key(target, "keydown", "KeyL", { meta: true })).toBe(true);
    keyboard.dispose();
  });
});
