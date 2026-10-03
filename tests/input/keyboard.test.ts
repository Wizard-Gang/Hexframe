import { describe, expect, it } from "vitest";

import { InputBit } from "../../src/combat/types";
import { KeyboardController } from "../../src/input/controller/keyboard";
import { DEFAULT_ACTION_KEYMAP, DEFAULT_KEYMAP_P1 } from "../../src/input/controller/keymap";

function key(
  target: EventTarget,
  type: "keydown" | "keyup",
  code: string,
  modifiers: { ctrl?: boolean; meta?: boolean; shift?: boolean; alt?: boolean } = {},
): boolean {
  const event = new Event(type, { cancelable: true });
  Object.defineProperties(event, {
    code: { value: code },
    ctrlKey: { value: modifiers.ctrl ?? false },
    metaKey: { value: modifiers.meta ?? false },
    shiftKey: { value: modifiers.shift ?? false },
    altKey: { value: modifiers.alt ?? false },
  });
  return target.dispatchEvent(event);
}

describe("keyboard input adapter", () => {
  it("maps the unmodified arrow diamond to exactly four actions", () => {
    const cases = [
      ["ArrowUp", InputBit.Action1],
      ["ArrowLeft", InputBit.Action2],
      ["ArrowRight", InputBit.Action3],
      ["ArrowDown", InputBit.Action4],
    ] as const;
    for (const [code, expected] of cases) {
      const target = new EventTarget();
      const keyboard = new KeyboardController(target, DEFAULT_KEYMAP_P1, DEFAULT_ACTION_KEYMAP);
      expect(key(target, "keydown", code)).toBe(false);
      expect(keyboard.sample()).toBe(expected);
      key(target, "keyup", code);
      keyboard.dispose();
    }
  });

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

  it("does not capture the retired IJKL second-player controls", () => {
    const target = new EventTarget();
    const keyboard = new KeyboardController(target, DEFAULT_KEYMAP_P1, DEFAULT_ACTION_KEYMAP);
    for (const code of ["KeyI", "KeyJ", "KeyK", "KeyL"]) {
      expect(key(target, "keydown", code)).toBe(true);
      expect(keyboard.sample()).toBe(0);
    }
    keyboard.dispose();
  });

  it("leaves modified action arrows to the page instead of selecting another attack", () => {
    for (const modifiers of [{ shift: true }, { ctrl: true }, { meta: true }, { shift: true, ctrl: true }]) {
      const target = new EventTarget();
      const keyboard = new KeyboardController(target, DEFAULT_KEYMAP_P1, DEFAULT_ACTION_KEYMAP);
      expect(key(target, "keydown", "ArrowUp", modifiers)).toBe(true);
      expect(keyboard.sample()).toBe(0);
      keyboard.dispose();
    }
  });
});
