import { describe, expect, it } from "vitest";

import { depthProfileName } from "../../src/rig/depth";
import { visualPaintOrder } from "../../src/rig/paint-order";
import { createRig } from "../../src/rig/rig";
import { rig } from "./fixtures";

describe("FightLab depth profiles and paint order", () => {
  it("paints every one of the 11 bones exactly once for every profile at both facings", () => {
    const expected = rig.bones.map((bone) => bone.name).sort();
    for (const profile of Object.keys(rig.contract.depthProfiles.profiles)) {
      for (const facing of [1, -1] as const) {
        const order = visualPaintOrder(rig, facing, profile);
        expect(order, `${profile} facing ${facing}`).toHaveLength(11);
        expect(new Set(order).size, `${profile} facing ${facing}`).toBe(11);
        expect([...order].sort(), `${profile} facing ${facing}`).toEqual(expected);
      }
    }
  });

  it("resolves clip mappings before falling back to the default profile", () => {
    const mapped = createRig({
      ...rig.contract,
      depthProfiles: {
        ...rig.contract.depthProfiles,
        byClip: { labWalk: "locomotion" },
      },
    });

    expect(depthProfileName(mapped, "labWalk")).toBe("locomotion");
    expect(depthProfileName(mapped, "unknown", "labWalk")).toBe("locomotion");
    expect(depthProfileName(mapped, "unknown", null)).toBe("anatomical");
  });
});
