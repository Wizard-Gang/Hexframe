import { describe, expect, it } from "vitest";
import { actionBit, InputBit } from "../../src/combat/types";
import { GamepadController } from "../../src/input/controller/gamepad";
import type { GamepadSource } from "../../src/input/controller/gamepad";

function sourceWith(buttons: number[], axes: number[] = [0, 0]): GamepadSource {
  const gamepadButtons = Array.from({ length: 17 }, (_, index) => ({
    pressed: buttons.includes(index),
    touched: buttons.includes(index),
    value: buttons.includes(index) ? 1 : 0,
  }));
  const pad = {
    axes,
    buttons: gamepadButtons,
    connected: true,
    id: "Standard Test Pad",
    index: 0,
    mapping: "standard",
    timestamp: 1,
    vibrationActuator: null,
    hapticActuators: [],
  } as unknown as Gamepad;
  return { getGamepads: () => [pad] };
}

describe("standard gamepad mapping", () => {
  it("maps the stick and d-pad to absolute movement", () => {
    const controller = new GamepadController(0, sourceWith([12, 14]));
    expect(controller.sample() & (InputBit.Up | InputBit.Left)).toBe(InputBit.Up | InputBit.Left);
    const stick = new GamepadController(0, sourceWith([], [0.8, 0.8]));
    expect(stick.sample() & (InputBit.Down | InputBit.Right)).toBe(InputBit.Down | InputBit.Right);
  });

  it("maps Y/X/B/A spatially to the four fixed actions", () => {
    expect(new GamepadController(0, sourceWith([3])).sample()).toBe(actionBit(0));
    expect(new GamepadController(0, sourceWith([2])).sample()).toBe(actionBit(1));
    expect(new GamepadController(0, sourceWith([1])).sample()).toBe(actionBit(2));
    expect(new GamepadController(0, sourceWith([0])).sample()).toBe(actionBit(3));
  });

  it("ignores trigger presses for attack selection", () => {
    expect(new GamepadController(0, sourceWith([6, 3])).sample()).toBe(actionBit(0));
    expect(new GamepadController(0, sourceWith([7, 2])).sample()).toBe(actionBit(1));
    expect(new GamepadController(0, sourceWith([6, 7, 0])).sample()).toBe(actionBit(3));
  });
});
