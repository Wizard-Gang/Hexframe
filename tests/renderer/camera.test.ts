import { describe, expect, it } from "vitest";
import { px } from "../../src/combat/constants";
import { cameraFrame } from "../../src/renderer/svg/stage";

describe("two-fighter framing", () => {
  it("keeps separated and airborne fighters inside both desktop viewports", () => {
    for (const aspect of [1440 / 814, 1280 / 634]) {
      for (const positions of [[-105, 105, 0], [-480, 480, 63], [240, 480, 140]]) {
        const [left, right, altitude] = positions as [number, number, number];
        const frame = cameraFrame([{ x: px(left), y: px(altitude) }, { x: px(right), y: 0 }], aspect);
        expect(frame.x).toBeLessThanOrEqual(left - 80);
        expect(frame.x + frame.width).toBeGreaterThanOrEqual(right + 80);
        expect(frame.y).toBeLessThanOrEqual(-altitude - 160);
        expect(frame.y + frame.height).toBe(65);
      }
    }
  });
});
