import { describe, expect, it } from "vitest";

import { CONTACT_EFFECT_FRAMES, ContactEffectQueue } from "../../src/renderer/svg/contact-effects";

describe("contact effect queue", () => {
  it("spawns presentation effects and expires them after ten frames", () => {
    const queue = new ContactEffectQueue();
    queue.spawn({ kind: "hit", x: 1200, y: 3400, large: true }, 42);
    queue.spawn({ kind: "block", x: 1600, y: 3100, large: false }, 42);

    expect(queue.active(42)).toEqual([
      { kind: "hit", x: 1200, y: 3400, large: true, spawnedFrame: 42 },
      { kind: "block", x: 1600, y: 3100, large: false, spawnedFrame: 42 },
    ]);
    expect(queue.active(42 + CONTACT_EFFECT_FRAMES - 1)).toHaveLength(2);
    expect(queue.active(42 + CONTACT_EFFECT_FRAMES)).toEqual([]);
  });
});
