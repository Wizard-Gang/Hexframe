import { expect, it } from "vitest";
import { HealthChip } from "../../src/lab/health-chip";

it("holds damage briefly, drains, and restarts from the visible trail on another hit", () => {
  const chip = new HealthChip();
  expect(chip.update(80, 1000)).toBe(100);
  expect(chip.update(80, 1120)).toBe(100);
  expect(chip.update(80, 1310)).toBe(90);
  expect(chip.update(60, 1310)).toBe(90);
  expect(chip.update(60, 1620)).toBe(75);
  expect(chip.update(60, 1810)).toBe(60);
  expect(chip.update(60, 3000)).toBe(60);
});

it("clears old damage on healing and match reset", () => {
  const chip = new HealthChip();
  chip.update(0, 1000);
  expect(chip.update(100, 1100)).toBe(100);
  chip.update(50, 1200);
  chip.reset();
  expect(chip.update(100, 1210)).toBe(100);
});
